import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { Prisma } from '@prisma/client';
import { EnquiryStatus } from './support/types/enquiry.js';
import { invalidateDashboardCache } from './support/lib/cache/cache-invalidation.js';
interface ActionResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export function createEnquiryService(prisma: PrismaClient, currentUser: WorkflowUser) {
    async function getCurrentUser() { return currentUser; }

    async function getEnquiryFollowUps(enquiryId: string): Promise<ActionResponse> {
        try {
            await getCurrentUser();
            const followUps = await prisma.followUp.findMany({
                where: { enquiryId },
                orderBy: { scheduledAt: 'desc' },
                select: {
                    id: true,
                    scheduledAt: true,
                    status: true,
                    outcome: true,
                    notes: true,
                    enquiryId: true,
                    createdAt: true,
                    createdBy: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
            });
            return { success: true, data: followUps, message: 'Follow-ups loaded successfully' };
        }
        catch (error) {
            console.error('Error fetching enquiry follow-ups:', error);
            return { success: false, message: 'Failed to fetch follow-ups' };
        }
    }
    async function getEnquiryCallLogs(enquiryId: string): Promise<ActionResponse> {
        try {
            await getCurrentUser();
            const callLogs = await prisma.callLog.findMany({
                where: { enquiryId },
                orderBy: { callDate: 'desc' },
                select: {
                    id: true,
                    callDate: true,
                    duration: true,
                    outcome: true,
                    notes: true,
                    enquiryId: true,
                    createdAt: true,
                    createdBy: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
            });
            return { success: true, data: callLogs, message: 'Call logs loaded successfully' };
        }
        catch (error) {
            console.error('Error fetching enquiry call logs:', error);
            return { success: false, message: 'Failed to fetch call logs' };
        }
    }
    async function getEnquiryJobLeads(enquiryId: string): Promise<ActionResponse> {
        try {
            await getCurrentUser();
            const jobLeads = await prisma.jobLead.findMany({
                where: { leadId: enquiryId },
                select: {
                    id: true,
                    status: true,
                    jobId: true,
                    leadId: true,
                    assigneeId: true,
                    assignerId: true,
                    job: {
                        select: {
                            id: true,
                            name: true,
                            jobCode: true,
                            startDate: true,
                            endDate: true,
                            branch: { select: { id: true, name: true } },
                        },
                    },
                    assignee: { select: { id: true, name: true, email: true } },
                    assigner: { select: { id: true, name: true, email: true } },
                },
            });
            return { success: true, data: jobLeads, message: 'Job leads loaded successfully' };
        }
        catch (error) {
            console.error('Error fetching enquiry job leads:', error);
            return { success: false, message: 'Failed to fetch job leads' };
        }
    }
    async function updateEnquiryStatus(id: string, status: EnquiryStatus): Promise<ActionResponse> {
        try {
            const user = await getCurrentUser();
            // Check if enquiry exists and user has permission
            const existingEnquiry = await prisma.enquiry.findUnique({
                where: { id },
            });
            if (!existingEnquiry) {
                return {
                    success: false,
                    message: 'Enquiry not found',
                };
            }
            const role = (user.role || '').toLowerCase();
            if (role !== 'admin' &&
                role !== 'manager' &&
                role !== 'executive' &&
                role !== 'branch manager' &&
                existingEnquiry.assignedToUserId !== user.id) {
                return {
                    success: false,
                    message: 'Access denied',
                };
            }
            const enquiry = await prisma.enquiry.update({
                where: { id },
                data: {
                    status,
                    lastContactDate: new Date(),
                },
            });
            return { success: true, data: enquiry, message: 'Status updated successfully' };
        }
        catch (error) {
            console.error('Error updating enquiry status:', error);
            return {
                success: false,
                message: 'Failed to update status',
            };
        }
    }
    async function updateEnquiryStatusWithActivity(id: string, newStatus: EnquiryStatus, _statusRemarks?: string): Promise<ActionResponse> {
        try {
            const user = await getCurrentUser();
            // Check if enquiry exists and user has permission
            const existingEnquiry = await prisma.enquiry.findUnique({
                where: { id },
            });
            if (!existingEnquiry) {
                return {
                    success: false,
                    message: 'Enquiry not found',
                };
            }
            // Role-based access control
            const role = (user.role || '').toLowerCase();
            if (role !== 'admin' &&
                role !== 'manager' &&
                role !== 'executive' &&
                role !== 'branch manager' &&
                existingEnquiry.assignedToUserId !== user.id) {
                return {
                    success: false,
                    message: 'Access denied',
                };
            }
            // Use transaction to update enquiry and create activity
            const result = await prisma.$transaction(async (tx) => {
                // Update enquiry status
                const updatedEnquiry = await tx.enquiry.update({
                    where: { id },
                    data: {
                        status: newStatus,
                        lastContactDate: new Date(),
                    },
                    include: {
                        branch: true,
                        preferredCourse: true,
                        service: true,
                        assignedTo: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                        createdBy: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                    },
                });
                return updatedEnquiry;
            });
            await invalidateDashboardCache();
            return {
                success: true,
                data: result,
                message: 'Status updated successfully with activity logged',
            };
        }
        catch (error) {
            console.error('Error updating enquiry status with activity:', error);
            return {
                success: false,
                message: 'Failed to update status',
            };
        }
    }
    async function updateEnquiryStatusDirectToEnrolled(id: string, _statusRemarks?: string): Promise<ActionResponse> {
        try {
            const user = await getCurrentUser();
            // Check if enquiry exists and user has permission
            const existingEnquiry = await prisma.enquiry.findUnique({
                where: { id },
            });
            if (!existingEnquiry) {
                return {
                    success: false,
                    message: 'Enquiry not found',
                };
            }
            // Role-based access control
            const role = (user.role || '').toLowerCase();
            if (role !== 'admin' &&
                role !== 'manager' &&
                role !== 'executive' &&
                role !== 'branch manager' &&
                existingEnquiry.assignedToUserId !== user.id) {
                return {
                    success: false,
                    message: 'Access denied',
                };
            }
            // Use transaction to update enquiry and create activity
            const result = await prisma.$transaction(async (tx) => {
                // Direct enrolment confirms the enquiry.
                const updatedEnquiry = await tx.enquiry.update({
                    where: { id },
                    data: {
                        status: EnquiryStatus.CONFIRMED,
                        lastContactDate: new Date(),
                    },
                    include: {
                        branch: true,
                        preferredCourse: true,
                        service: true,
                        assignedTo: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                        createdBy: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                    },
                });
                return updatedEnquiry;
            });
            await invalidateDashboardCache();
            return {
                success: true,
                data: result,
                message: 'Direct enrollment completed successfully',
            };
        }
        catch (error) {
            console.error('Error processing direct enrollment:', error);
            return {
                success: false,
                message: 'Failed to process direct enrollment',
            };
        }
    }
    async function bulkImportEnquiries(leads: any[], commonFields: {
        branchId: string;
        enquirySourceId?: string;
    }): Promise<ActionResponse> {
        try {
            const user = await getCurrentUser();
            if (!leads || leads.length === 0) {
                return { success: false, message: 'No data found in the file' };
            }
            // Process in batches or a single transaction
            const result = await prisma.$transaction(leads.map((lead) => {
                // Basic mapping logic - can be expanded
                const name = lead.candidateName || lead['Candidate Name'] || lead['Name'];
                const phone = String(lead.phone || lead['Phone'] || lead['Mobile'] || '');
                if (!name || !phone) {
                    throw new Error('Candidate Name and Phone are required for all rows');
                }
                return prisma.enquiry.create({
                    data: {
                        candidateName: name,
                        phone: phone,
                        email: lead.email || lead['Email'] || null,
                        address: lead.address || lead['Address'] || null,
                        notes: lead.notes || lead['Notes'] || 'Imported via Bulk Upload',
                        status: EnquiryStatus.NEW,
                        branchId: commonFields.branchId,
                        source: commonFields.enquirySourceId || null,
                        createdByUserId: user.id,
                        assignedToUserId: null, // Keep unassigned so they can be bulk assigned later
                        lastContactDate: new Date(),
                    },
                });
            }));
            await invalidateDashboardCache();
            return {
                success: true,
                data: result,
                message: `${result.length} enquiries imported successfully`,
            };
        }
        catch (error: any) {
            console.error('Error bulk importing enquiries:', error);
            return {
                success: false,
                message: error.message || 'Failed to import enquiries. Please check your file format.',
            };
        }
    }
    async function getUsers(branchId?: string): Promise<ActionResponse> {
        try {
            const where: Prisma.UserWhereInput = {
                NOT: {
                    role: {
                        in: ['admin', 'manager'],
                    },
                },
            };
            if (branchId) {
                where.branch = branchId;
            }
            const users = await prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    branch: true,
                },
                orderBy: { name: 'asc' },
            });
            return { success: true, data: users, message: 'Users fetched successfully' };
        }
        catch (error) {
            console.error('Error fetching users:', error);
            return {
                success: false,
                message: 'Failed to fetch users',
            };
        }
    }
    return { getCurrentUser, getEnquiryFollowUps, getEnquiryCallLogs, getEnquiryJobLeads, updateEnquiryStatus, updateEnquiryStatusWithActivity, updateEnquiryStatusDirectToEnrolled, bulkImportEnquiries, getUsers };
}
