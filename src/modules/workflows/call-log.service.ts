import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { CreateCallLogInput, CallLogFilters } from './support/types/enquiry.js';
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
import { normalizePagination, validateSortField, validateSortOrder, buildPaginationResult, } from './support/lib/pagination-utils.js';
export function createCallLogService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const workflowSession = { user: currentUser, session: { id: currentUser.id, userId: currentUser.id } };
    async function getCurrentUser() {
        const session = workflowSession;
        if (!session) {
            throw new Error('Unauthorized');
        }
        return session.user;
    }
    async function createCallLog(data: CreateCallLogInput): Promise<ActionResponse> {
        try {
            const user = await getCurrentUser();
            // Check if user has access to the enquiry
            const enquiry = await prisma.enquiry.findUnique({
                where: { id: data.enquiryId },
            });
            if (!enquiry) {
                return {
                    success: false,
                    message: 'Enquiry not found',
                };
            }
            if (user.role === 'telecaller' && enquiry.assignedToUserId !== user.id) {
                return {
                    success: false,
                    message: 'Access denied',
                };
            }
            // Use transaction to create call log and activity
            const result = await prisma.$transaction(async (tx) => {
                // Create call log
                const callLog = await tx.callLog.create({
                    data: {
                        ...data,
                        createdByUserId: user.id,
                    },
                    include: {
                        enquiry: {
                            include: {
                                branch: true,
                                preferredCourse: true,
                            },
                        },
                        createdBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                });
                // Update enquiry's last contact date
                await tx.enquiry.update({
                    where: { id: data.enquiryId },
                    data: { lastContactDate: new Date() },
                });
                return callLog;
            });
            await invalidateDashboardCache();
            return { success: true, data: result, message: 'Call log created successfully' };
        }
        catch (error) {
            console.error('Error creating call log:', error);
            return {
                success: false,
                message: 'Failed to create call log',
            };
        }
    }
    const CALL_LOG_SORT_FIELDS = ['callDate', 'createdAt', 'duration'];
    async function getCallLogs(filters: CallLogFilters = {}): Promise<ActionResponse> {
        try {
            const user = await getCurrentUser();
            const { page, limit, skip } = normalizePagination({
                page: filters.page,
                limit: filters.limit,
            });
            const sortBy = validateSortField(filters.sortBy, CALL_LOG_SORT_FIELDS, 'callDate');
            const sortOrder = validateSortOrder(filters.sortOrder, 'desc');
            const { outcome, dateFrom, dateTo, search, enquiryId, branchId, assignedToUserId } = filters;
            // Build where clause
            const where: Record<string, unknown> = {};
            const enquiryWhere: Record<string, unknown> = {};
            // Role-based filtering
            const role = (user.role || '').toLowerCase();
            if (role === 'telecaller') {
                enquiryWhere.assignedToUserId = user.id;
            }
            else if ((role === 'executive' || role === 'manager' || role === 'branch manager') && user.branch) {
                enquiryWhere.branchId = user.branch;
                if (assignedToUserId)
                    enquiryWhere.assignedToUserId = assignedToUserId;
            }
            else if (user.role === 'admin') {
                if (branchId)
                    enquiryWhere.branchId = branchId;
                if (assignedToUserId)
                    enquiryWhere.assignedToUserId = assignedToUserId;
            }
            if (search && search.trim()) {
                enquiryWhere.OR = [
                    { candidateName: { contains: search.trim(), mode: 'insensitive' } },
                    { phone: { contains: search.trim(), mode: 'insensitive' } },
                ];
            }
            if (Object.keys(enquiryWhere).length > 0) {
                where.enquiry = enquiryWhere;
            }
            if (enquiryId) {
                where.enquiryId = enquiryId;
            }
            if (outcome) {
                where.outcome = outcome;
            }
            if (dateFrom || dateTo) {
                const callDateFilter: Record<string, Date> = {};
                if (dateFrom)
                    callDateFilter.gte = dateFrom;
                if (dateTo)
                    callDateFilter.lte = dateTo;
                where.callDate = callDateFilter;
            }
            const [callLogs, total] = await Promise.all([
                prisma.callLog.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    select: {
                        id: true,
                        callDate: true,
                        duration: true,
                        outcome: true,
                        notes: true,
                        enquiryId: true,
                        createdAt: true,
                        enquiry: {
                            select: {
                                id: true,
                                candidateName: true,
                                phone: true,
                                status: true,
                            },
                        },
                        createdBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                }),
                prisma.callLog.count({ where }),
            ]);
            const pagination = buildPaginationResult(total, page, limit);
            return {
                success: true,
                data: callLogs,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total: pagination.total,
                    pages: pagination.totalPages,
                },
                message: 'Call logs fetched successfully',
            };
        }
        catch (error) {
            console.error('Error fetching call logs:', error);
            return {
                success: false,
                message: 'Failed to fetch call logs',
            };
        }
    }
    async function deleteCallLog(id: string): Promise<ActionResponse> {
        try {
            const user = await getCurrentUser();
            // Check if call log exists and user has permission
            const existingCallLog = await prisma.callLog.findUnique({
                where: { id },
                include: {
                    enquiry: true,
                },
            });
            if (!existingCallLog) {
                return {
                    success: false,
                    message: 'Call log not found',
                };
            }
            // Only allow deletion by admin or the assigned user
            if (user.role === 'telecaller' && existingCallLog.enquiry.assignedToUserId !== user.id) {
                return {
                    success: false,
                    message: 'Access denied',
                };
            }
            await prisma.callLog.delete({
                where: { id },
            });
            await invalidateDashboardCache();
            return { success: true, message: 'Call log deleted successfully' };
        }
        catch (error) {
            console.error('Error deleting call log:', error);
            return {
                success: false,
                message: 'Failed to delete call log',
            };
        }
    }
    return { createCallLog, getCallLogs, deleteCallLog };
}
