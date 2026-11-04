import type { Prisma } from '@prisma/client';
import { decimal } from '../../shared/utils/money.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { CreateServiceBilling, DeleteServiceBilling, UpdateServiceBilling, ServiceBilling, ServiceBillingWithAdmission, PayServiceBilling, ServiceBillItem } from "./support/types/service-billing.js";
interface ActionResponse<T> {
    success: boolean;
    message: string;
    data?: T;
}
import { normalizePagination, validateSortField, validateSortOrder, buildPaginationResult, } from './support/lib/pagination-utils.js';
export function createServiceActionsService(prisma: PrismaClient, _currentUser: WorkflowUser) {
    function generateServiceBillNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const random = Math.floor(Math.random() * 9999)
            .toString()
            .padStart(4, "0");
        return `SB-${year}${month}${day}-${random}`;
    }
    const SERVICE_BILLING_SORT_FIELDS = ['billDate', 'total', 'paid', 'balance', 'createdAt'];
    async function listServiceBilling(page = 1, pageSize = 20, searchQuery = "", sortBy: string = 'billDate', sortOrder: 'asc' | 'desc' = 'desc', serviceId = "", courseId = ""): Promise<ActionResponse<{
        data: ServiceBillingWithAdmission[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            pages: number;
        };
    }>> {
        try {
            const { page: validPage, limit: validPageSize, skip } = normalizePagination({
                page,
                limit: pageSize,
            });
            const validSortBy = validateSortField(sortBy, SERVICE_BILLING_SORT_FIELDS, 'billDate');
            const validSortOrder = validateSortOrder(sortOrder, 'desc');
            const orderBy = { [validSortBy]: validSortOrder };
            // Build where clause for filtering
            const whereClause: any = {};
            // Search by candidate name or admission number
            if (searchQuery.trim()) {
                whereClause.admission = {
                    OR: [
                        {
                            candidateName: {
                                contains: searchQuery.trim(),
                                mode: 'insensitive'
                            }
                        },
                        {
                            admissionNumber: {
                                contains: searchQuery.trim(),
                                mode: 'insensitive'
                            }
                        }
                    ]
                };
            }
            // Filter by specific required capacity / course
            if (courseId && courseId.trim() && courseId !== "all") {
                whereClause.admission = {
                    ...(whereClause.admission || {}),
                    courseId: courseId,
                };
            }
            // Filter by specific service
            if (serviceId && serviceId.trim() && serviceId !== "all") {
                whereClause.serviceIds = {
                    has: serviceId
                };
            }
            // Get total count for pagination with the same filters
            const totalCount = await (prisma as any).serviceBill?.count?.({
                where: whereClause,
            }) ?? 0;
            // Fetch service bills with filters
            const serviceBilling = await (prisma as any).serviceBill?.findMany?.({
                skip,
                take: validPageSize,
                where: whereClause,
                include: {
                    admission: {
                        select: {
                            id: true,
                            candidateName: true,
                            admissionNumber: true,
                            course: {
                                select: {
                                    id: true,
                                    name: true,
                                    duration: true,
                                    courseFee: true,
                                    admissionFee: true,
                                    semesterFee: true,
                                },
                            },
                        },
                    },
                },
                orderBy,
            }) ?? [];
            // Batch fetch all unique services across all bills in this page (eliminates N+1 query)
            const allServiceIds: string[] = Array.from(new Set((serviceBilling as any[]).flatMap((bill: any) => bill.serviceIds || [])));
            const services = allServiceIds.length > 0
                ? await prisma.service.findMany({
                    where: {
                        id: { in: allServiceIds },
                    },
                    select: {
                        id: true,
                        name: true,
                        price: true,
                    },
                })
                : [];
            const serviceMap = new Map(services.map((s) => [s.id, s]));
            const serviceBillingWithServices = (serviceBilling as any[]).map((bill: any) => ({
                ...bill,
                services: (bill.serviceIds || [])
                    .map((id: string) => serviceMap.get(id))
                    .filter(Boolean),
            }));
            const pagination = buildPaginationResult(totalCount, validPage, validPageSize);
            return {
                success: true,
                message: "Service billing fetched successfully",
                data: {
                    data: serviceBillingWithServices as ServiceBillingWithAdmission[],
                    pagination: {
                        page: pagination.page,
                        pageSize: pagination.limit,
                        total: pagination.total,
                        pages: pagination.totalPages,
                    },
                },
            };
        }
        catch (error) {
            console.error("Error fetching service billing:", error);
            return {
                success: false,
                message: "Failed to fetch service billing",
                data: {
                    data: [],
                    pagination: {
                        page,
                        pageSize,
                        total: 0,
                        pages: 0,
                    },
                },
            };
        }
    }
    async function createServiceBilling(input: CreateServiceBilling): Promise<ActionResponse<ServiceBilling | null>> {
        try {
            if (!input.serviceIds || !input.admissionId) {
                return {
                    success: false,
                    message: "Service ids, total and admission id are required",
                    data: null,
                };
            }
            const billId = generateServiceBillNumber();
            const services = await prisma.service.findMany({
                where: {
                    id: {
                        in: input.serviceIds
                    }
                },
                select: {
                    price: true,
                },
            });
            const total = services.reduce((total, service) => decimal(total).plus(service.price), decimal(0));
            const isPaid = input.paid !== undefined && decimal(input.paid).greaterThan(0);
            let status: "PAID" | "UNPAID" | "PARTIALLY_PAID" = "UNPAID";
            let balance: Prisma.Decimal.Value = total;
            if (isPaid && input.paid && decimal(input.paid).greaterThan(0)) {
                if (decimal(input.paid).greaterThanOrEqualTo(total)) {
                    status = "PAID";
                    balance = decimal(0);
                }
                else {
                    status = "PARTIALLY_PAID";
                    balance = decimal(total).minus(input.paid);
                }
            }
            const createData = {
                billId: billId,
                serviceIds: input.serviceIds,
                total: total,
                billDate: input.billDate,
                admissionId: input.admissionId,
                status: status,
                balance: balance,
                ...(isPaid && { paid: input.paid }),
            };
            const serviceBilling = await prisma.serviceBill.create({
                data: createData,
            });
            if (!serviceBilling) {
                return {
                    success: false,
                    message: "Failed to create service billing",
                    data: null,
                };
            }
            if (isPaid && input.paid && decimal(input.paid).greaterThan(0)) {
                const serviceBillItem = await prisma.serviceBillItem.create({
                    data: {
                        serviceBillId: serviceBilling.id,
                        amount: input.paid,
                        ...(input.paymentMode && { paymentMode: input.paymentMode }),
                    }
                });
                if (!serviceBillItem) {
                    return {
                        success: false,
                        message: "Failed to create service billing item",
                        data: null,
                    };
                }
            }
            return {
                success: true,
                message: "Service billing created successfully",
                data: serviceBilling,
            };
        }
        catch (error) {
            console.error("Error creating service billing:", error);
            return {
                success: false,
                message: "Failed to create service billing due to an internal error.",
                data: null,
            };
        }
    }
    async function updateServiceBilling(input: UpdateServiceBilling): Promise<ActionResponse<ServiceBilling | null>> {
        try {
            if (!input.id) {
                return {
                    success: false,
                    message: "Service billing id is required",
                    data: null,
                };
            }
            const serviceBilling = await prisma.serviceBill.update({
                where: { id: input.id },
                data: {
                    serviceIds: input.serviceIds,
                },
            });
            if (!serviceBilling) {
                return {
                    success: false,
                    message: "Failed to update service billing",
                    data: null,
                };
            }
            return {
                success: true,
                message: "Service billing updated successfully",
                data: serviceBilling,
            };
        }
        catch (error) {
            console.error("Error updating service billing:", error);
            return {
                success: false,
                message: "Failed to update service billing",
            };
        }
    }
    async function getServiceBillHistory(id: string): Promise<ActionResponse<ServiceBillItem[]>> {
        try {
            const serviceBillHistory = await prisma.serviceBillItem.findMany({
                where: { serviceBillId: id },
                orderBy: { createdAt: "desc" },
            });
            return {
                success: true,
                message: "Service bill history fetched successfully",
                data: serviceBillHistory,
            };
        }
        catch (error) {
            console.error("Error fetching service bill history:", error);
            return {
                success: false,
                message: "Failed to fetch service bill history",
            };
        }
    }
    async function payServiceBilling(input: PayServiceBilling): Promise<ActionResponse<ServiceBilling | null>> {
        try {
            const existingBill = await prisma.serviceBill.findUnique({
                where: { id: input.id },
            });
            if (!existingBill) {
                return {
                    success: false,
                    message: "Service bill not found.",
                    data: null,
                };
            }
            const newTotalPaid = decimal(existingBill.paid).plus(input.paid);
            const newBalance = decimal(existingBill.total).minus(newTotalPaid);
            let newStatus = existingBill.status;
            if (decimal(newBalance).lessThanOrEqualTo(0)) {
                newStatus = "PAID";
            }
            else if (decimal(newTotalPaid).greaterThan(0)) {
                newStatus = "PARTIALLY_PAID";
            }
            const serviceBilling = await prisma.serviceBill.update({
                where: { id: input.id },
                data: {
                    paid: newTotalPaid,
                    balance: newBalance,
                    status: newStatus,
                },
            });
            if (!serviceBilling) {
                return {
                    success: false,
                    message: "Failed to update service billing",
                    data: null,
                };
            }
            if (decimal(input.paid).greaterThan(0)) {
                const serviceBillItem = await prisma.serviceBillItem.create({
                    data: {
                        serviceBillId: serviceBilling.id,
                        amount: input.paid,
                        ...(input.paymentMode && { paymentMode: input.paymentMode }),
                    }
                });
                if (!serviceBillItem) {
                    return {
                        success: false,
                        message: "Failed to create service billing item",
                        data: null,
                    };
                }
            }
            return {
                success: true,
                message: "Payment successfully processed.",
                data: serviceBilling,
            };
        }
        catch (error) {
            console.error("Error processing payment:", error);
            return {
                success: false,
                message: "Failed to process payment due to a server error.",
                data: null,
            };
        }
    }
    async function getServiceBillByStudentId(studentId: string): Promise<ActionResponse<ServiceBilling | null>> {
        try {
            const serviceBill = await prisma.serviceBill.findFirst({
                where: { admissionId: studentId },
            });
            if (!serviceBill) {
                return {
                    success: false,
                    message: "Service billing not found",
                    data: null,
                };
            }
            return {
                success: true,
                message: "Service billing fetched successfully",
                data: serviceBill,
            };
        }
        catch (error) {
            console.error("Error fetching service billing:", error);
            return {
                success: false,
                message: "Failed to fetch service billing",
            };
        }
    }
    async function deleteServiceBilling(input: DeleteServiceBilling): Promise<ActionResponse<boolean>> {
        try {
            await (prisma as any).serviceBill?.delete?.({
                where: { id: input.id },
            });
            return {
                success: true,
                message: "Service billing deleted successfully",
                data: true,
            };
        }
        catch (error) {
            console.error("Error deleting service billing:", error);
            return {
                success: false,
                message: "Failed to delete service billing",
                data: false,
            };
        }
    }
    async function listStudents(): Promise<ActionResponse<{
        id: string;
        candidateName: string;
        admissionNumber: string;
        course?: {
            id: string;
            name: string;
            duration?: string | null;
            courseFee?: Prisma.Decimal.Value | null;
        } | null;
    }[]>> {
        try {
            const students = await prisma.admission.findMany({
                where: {
                    status: {
                        not: "CANCELLED",
                    },
                },
                select: {
                    id: true,
                    candidateName: true,
                    admissionNumber: true,
                    course: {
                        select: {
                            id: true,
                            name: true,
                            duration: true,
                            courseFee: true,
                        },
                    },
                },
                orderBy: {
                    candidateName: "asc",
                },
            });
            return {
                success: true,
                message: "Customers fetched successfully",
                data: students,
            };
        }
        catch (error) {
            console.error("Error fetching customers:", error);
            return {
                success: false,
                message: "Failed to fetch customers",
                data: [],
            };
        }
    }
    async function listServices(): Promise<ActionResponse<{
        id: string;
        name: string;
        price: Prisma.Decimal.Value;
    }[]>> {
        try {
            const services = await prisma.service.findMany({
                select: {
                    id: true,
                    name: true,
                    price: true,
                },
            });
            return {
                success: true,
                message: "Services fetched successfully",
                data: services,
            };
        }
        catch (error) {
            console.error("Error fetching services:", error);
            return {
                success: false,
                message: "Failed to fetch services",
                data: [],
            };
        }
    }
    async function totalListing(): Promise<ActionResponse<{
        total: number;
    }>> {
        try {
            const total = await (prisma as any).serviceBill?.aggregate?.({
                _sum: {
                    total: true,
                },
            });
            return {
                success: true,
                message: "Total listing fetched successfully",
                data: {
                    total: total?._sum?.total ?? 0,
                },
            };
        }
        catch (error) {
            console.error("Error fetching total listing:", error);
            return {
                success: false,
                message: "Failed to fetch total listing",
                data: {
                    total: 0,
                },
            };
        }
    }
    async function getServiceBillById(id: string) {
        if (!id)
            return null;
        try {
            const serviceBill = await prisma.serviceBill.findUnique({
                where: { id },
            });
            return {
                success: true,
                message: "Service bill fetched successfully",
                data: serviceBill,
            };
        }
        catch (error) {
            console.error(`Failed to fetch service bill [${id}]:`, error);
            return {
                success: false,
                message: "Failed to fetch service bill",
            };
        }
    }
    async function getServicesByIds(ids: string[]) {
        if (!ids || ids.length === 0)
            return [];
        try {
            const services = await prisma.service.findMany({
                where: {
                    id: { in: ids },
                },
            });
            return {
                success: true,
                message: "Services fetched successfully",
                data: services,
            };
        }
        catch (error) {
            console.error("Failed to fetch services by IDs:", error);
            return {
                success: false,
                message: "Failed to fetch services by IDs",
            };
        }
    }
    async function getAdmissionHistoryById(id: string) {
        if (!id)
            return null;
        try {
            const admission = await prisma.admission.findUnique({
                where: { id },
                include: {
                    course: true,
                    createdBy: {
                        select: { id: true, name: true, email: true },
                    },
                    receipts: {
                        orderBy: { createdAt: "desc" },
                    },
                    serviceBills: {
                        orderBy: { createdAt: "desc" },
                    },
                },
            });
            return {
                success: true,
                message: "Admission history fetched successfully",
                data: admission,
            };
        }
        catch (error) {
            console.error(`Failed to fetch admission history [${id}]:`, error);
            return {
                success: false,
                message: "Failed to fetch admission history",
            };
        }
    }
    async function getServiceBillDetailsForPDF(id: string) {
        try {
            if (!id) {
                return { success: false, message: "Service Bill ID is required." };
            }
            // Step 1: Fetch the core service bill and include the related student's info
            const serviceBill = await prisma.serviceBill.findUnique({
                where: { id },
                include: {
                    admission: {
                        select: {
                            candidateName: true,
                            admissionNumber: true,
                            course: {
                                select: {
                                    id: true,
                                    name: true,
                                    duration: true,
                                    courseFee: true,
                                    admissionFee: true,
                                },
                            },
                        },
                    },
                },
            });
            if (!serviceBill) {
                return { success: false, message: "Service Bill not found." };
            }
            // Step 2: Fetch the details of the services using the IDs stored in the bill
            const services = await prisma.service.findMany({
                where: {
                    id: {
                        in: serviceBill.serviceIds,
                    },
                },
                select: {
                    name: true,
                    price: true,
                }
            });
            // Step 3: Combine the bill data with the fetched service details
            const detailedBillData = {
                ...serviceBill,
                services, // Attach the array of full service objects
            };
            return {
                success: true,
                message: "Service Bill details fetched successfully.",
                data: detailedBillData,
            };
        }
        catch (error) {
            console.error(`Error fetching service bill details for PDF [${id}]:`, error);
            return {
                success: false,
                message: "An error occurred while fetching the service bill details.",
            };
        }
    }
    return { listServiceBilling, createServiceBilling, updateServiceBilling, getServiceBillHistory, payServiceBilling, getServiceBillByStudentId, deleteServiceBilling, listStudents, listServices, totalListing, getServiceBillById, getServicesByIds, getAdmissionHistoryById, getServiceBillDetailsForPDF };
}
