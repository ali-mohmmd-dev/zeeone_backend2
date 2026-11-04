import { decimal } from '../../shared/utils/money.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { AdmissionStatus } from "@prisma/client";
import { CreateReceiptInput, UpdateReceiptInput, AdmissionWithReceiptsAndCourse, } from "./support/types/fee-collection.js";
import { calculateFeeDetails, calculateTotalFee, calculateTotalPaid, } from "./support/lib/fee-utils.js";
export function createFeeCollectionActionsService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const workflowSession = { user: currentUser, session: { id: currentUser.id, userId: currentUser.id } };
    async function createReceipt(data: CreateReceiptInput) {
        try {
            const session = workflowSession;
            if (!session?.user) {
                return { error: "Unauthorized" };
            }
            if (!data.amountCollected || decimal(data.amountCollected).lessThanOrEqualTo(0) || !decimal(data.amountCollected).isFinite()) {
                return { error: "Payment amount must be a valid positive number" };
            }
            const { nextDueDate, ...rest } = data;
            const result = await prisma.$transaction(async (tx) => {
                // 1. Acquire pessimistic row lock on the admission to prevent concurrent double-payment races
                await tx.$queryRaw `SELECT id FROM "admission" WHERE id = ${data.admissionId} FOR UPDATE`;
                // 2. Fetch fresh admission state and receipts within transaction
                const admission = (await tx.admission.findUnique({
                    where: { id: data.admissionId },
                    include: {
                        course: true,
                        receipts: {
                            include: {
                                createdBy: true,
                            },
                        },
                    },
                })) as unknown as AdmissionWithReceiptsAndCourse;
                if (!admission) {
                    throw new Error("Admission not found");
                }
                // 3. Compute remaining balance before adding this receipt
                const totalPaid = calculateTotalPaid(admission);
                const totalFee = calculateTotalFee(admission.course);
                const remainingBalance = decimal(totalFee).minus(totalPaid);
                if (decimal(data.amountCollected).greaterThan(remainingBalance)) {
                    throw new Error(`Payment of ₹${data.amountCollected.toLocaleString()} exceeds the remaining balance of ₹${remainingBalance.toLocaleString()}`);
                }
                // 4. Create the receipt atomically
                const receipt = await tx.receipt.create({
                    data: {
                        ...rest,
                        createdById: session.user.id,
                    },
                });
                // 5. Update admission with verified new balance
                const newBalance = decimal(remainingBalance).minus(data.amountCollected);
                await tx.admission.update({
                    where: { id: data.admissionId },
                    data: {
                        balance: decimal(newBalance).greaterThan(0) ? newBalance : 0,
                        nextDueDate: decimal(newBalance).lessThanOrEqualTo(0) ? null : nextDueDate,
                        status: decimal(newBalance).lessThanOrEqualTo(0) ? AdmissionStatus.CONFIRMED : (admission.status || AdmissionStatus.PENDING),
                    },
                });
                return receipt;
            });
            return { success: true, data: result };
        }
        catch (error) {
            console.error("Error creating receipt:", error);
            const message = error instanceof Error ? error.message : "Failed to create receipt";
            return { error: message };
        }
    }
    async function updateReceipt(data: UpdateReceiptInput) {
        try {
            const session = workflowSession;
            if (!session?.user) {
                return { error: "Unauthorized" };
            }
            const { id, nextDueDate, ...rest } = data;
            const receipt = await prisma.receipt.update({
                where: { id },
                data: rest,
            });
            // Get the admission to update balance
            const admission = (await prisma.admission.findFirst({
                where: { receipts: { some: { id } } },
                include: {
                    course: true,
                    receipts: {
                        include: {
                            createdBy: true,
                        },
                    },
                },
            })) as unknown as AdmissionWithReceiptsAndCourse;
            if (admission) {
                const totalPaid = calculateTotalPaid(admission);
                const totalFee = calculateTotalFee(admission.course);
                const balance = decimal(totalFee).minus(totalPaid);
                // Update admission with new balance
                await prisma.admission.update({
                    where: { id: admission.id },
                    data: {
                        nextDueDate: decimal(balance).lessThanOrEqualTo(0) ? null : nextDueDate,
                        balance: decimal(balance).greaterThan(0) ? balance : 0,
                    },
                });
            }
            return { success: true, data: receipt };
        }
        catch (error) {
            console.error("Error updating receipt:", error);
            return { error: "Failed to update receipt" };
        }
    }
    async function deleteReceipt(id: string) {
        try {
            const session = workflowSession;
            if (!session?.user) {
                return { error: "Unauthorized" };
            }
            // Find the receipt to get the admission ID before deleting
            const receipt = await prisma.receipt.findUnique({
                where: { id },
                select: { admissionId: true },
            });
            if (!receipt) {
                return { error: "Receipt not found" };
            }
            // Delete the receipt
            await prisma.receipt.delete({
                where: { id },
            });
            // Update admission balance
            const admission = await prisma.admission.findUnique({
                where: { id: receipt.admissionId },
                include: {
                    receipts: true,
                    course: true,
                },
            });
            if (admission) {
                // Calculate new balance
                const totalPaid = admission.receipts.reduce((sum, receipt) => decimal(sum).plus(receipt.amountCollected), decimal(0));
                const totalFee = decimal(admission.course.admissionFee || 0).plus((admission.course.courseFee || 0)).plus((admission.course.semesterFee || 0));
                const balance = decimal(totalFee).minus(totalPaid);
                // Update admission with new balance
                await prisma.admission.update({
                    where: { id: receipt.admissionId },
                    data: {
                        nextDueDate: null,
                        balance: decimal(balance).greaterThan(0) ? balance : 0,
                    },
                });
            }
            return { success: true };
        }
        catch (error) {
            console.error("Error deleting receipt:", error);
            return { error: "Failed to delete receipt" };
        }
    }
    async function getReceiptsByAdmissionId(admissionId: string) {
        try {
            const receipts = await prisma.receipt.findMany({
                where: { admissionId },
                orderBy: { paymentDate: "desc" },
                include: {
                    createdBy: true,
                },
            });
            return { success: true, data: receipts };
        }
        catch (error) {
            console.error("Error fetching receipts:", error);
            return { error: "Failed to fetch receipts" };
        }
    }
    async function getAdmissionWithFeeDetails(admissionId: string) {
        try {
            const admission = (await prisma.admission.findUnique({
                where: { id: admissionId },
                include: {
                    course: true,
                    receipts: {
                        orderBy: { paymentDate: "desc" },
                        include: {
                            createdBy: true,
                        },
                    },
                },
            })) as unknown as AdmissionWithReceiptsAndCourse;
            if (!admission) {
                return { error: "Admission not found" };
            }
            // Calculate fee details
            const feeDetails = calculateFeeDetails(admission as unknown as AdmissionWithReceiptsAndCourse);
            return {
                success: true,
                data: {
                    admission: admission as AdmissionWithReceiptsAndCourse,
                    feeDetails,
                },
            };
        }
        catch (error) {
            console.error("Error fetching admission with fee details:", error);
            return { error: "Failed to fetch admission details" };
        }
    }
    return { createReceipt, updateReceipt, deleteReceipt, getReceiptsByAdmissionId, getAdmissionWithFeeDetails };
}
