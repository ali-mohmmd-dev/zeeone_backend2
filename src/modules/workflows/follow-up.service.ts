import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { FollowUpStatus, CreateFollowUpInput, UpdateFollowUpInput, FollowUpFilters, } from './support/types/enquiry.js';
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

export function createFollowUpService(prisma: PrismaClient, user: WorkflowUser) {
    async function createFollowUp(data: CreateFollowUpInput): Promise<ActionResponse> {
        try {
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
            // Use transaction to create follow-up and activity
            const result = await prisma.$transaction(async (tx) => {
                // Create follow-up
                const followUp = await tx.followUp.create({
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
                return followUp;
            });
            await invalidateDashboardCache();
            return { success: true, data: result, message: 'Follow-up scheduled successfully' };
        }
        catch (error) {
            console.error('Error creating follow-up:', error);
            return {
                success: false,
                message: 'Failed to create follow-up',
            };
        }
    }
    const FOLLOW_UP_SORT_FIELDS = ['scheduledAt', 'createdAt', 'status'];
    async function getFollowUps(filters: FollowUpFilters = {}): Promise<ActionResponse> {
        try {
            const { page, limit, skip } = normalizePagination({
                page: filters.page,
                limit: filters.limit,
            });
            const sortBy = validateSortField(filters.sortBy, FOLLOW_UP_SORT_FIELDS, 'scheduledAt');
            const sortOrder = validateSortOrder(filters.sortOrder, 'asc');
            const { status, overdue, dateFrom, dateTo, search, branchId, assignedToUserId } = filters;
            // Build where clause
            const where: Record<string, unknown> = {};
            const enquiryWhere: Record<string, unknown> = {};
            // Role-based filtering
            if (user.role === 'admin') {
                // Admin sees all, filter by branch/user if provided
                if (branchId)
                    enquiryWhere.branchId = branchId;
                if (assignedToUserId)
                    enquiryWhere.assignedToUserId = assignedToUserId;
            }
            else if (user.role === 'manager' || user.role === 'executive' || user.role === 'branch manager') {
                // Manager sees follow-ups for their branch
                if (user.branch) {
                    enquiryWhere.branchId = user.branch;
                }
                else {
                    where.createdByUserId = user.id;
                }
                if (assignedToUserId)
                    enquiryWhere.assignedToUserId = assignedToUserId;
            }
            else {
                // Telecaller sees only their assigned follow-ups
                enquiryWhere.assignedToUserId = user.id;
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
            if (status && status.length > 0) {
                where.status = { in: status };
            }
            if (overdue) {
                where.AND = [{ status: FollowUpStatus.PENDING }, { scheduledAt: { lt: new Date() } }];
            }
            if (dateFrom || dateTo) {
                const scheduledAtFilter: Record<string, Date> = {};
                if (dateFrom)
                    scheduledAtFilter.gte = dateFrom;
                if (dateTo)
                    scheduledAtFilter.lte = dateTo;
                where.scheduledAt = scheduledAtFilter;
            }
            const [followUps, total] = await Promise.all([
                prisma.followUp.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    select: {
                        id: true,
                        scheduledAt: true,
                        status: true,
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
                                branch: { select: { id: true, name: true } },
                                preferredCourse: { select: { id: true, name: true } },
                                assignedTo: { select: { id: true, name: true } },
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
                prisma.followUp.count({ where }),
            ]);
            const pagination = buildPaginationResult(total, page, limit);
            return {
                success: true,
                data: followUps,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total: pagination.total,
                    pages: pagination.totalPages,
                },
                message: 'Follow-ups fetched successfully',
            };
        }
        catch (error) {
            console.error('Error fetching follow-ups:', error);
            return {
                success: false,
                message: 'Failed to fetch follow-ups',
            };
        }
    }
    async function updateFollowUp(data: UpdateFollowUpInput): Promise<ActionResponse> {
        try {
            const { id, rescheduledAt, ...updateData } = data;
            // Check if follow-up exists and user has permission
            const existingFollowUp = await prisma.followUp.findUnique({
                where: { id },
                include: {
                    enquiry: true,
                },
            });
            if (!existingFollowUp) {
                return {
                    success: false,
                    message: 'Follow-up not found',
                };
            }
            if (user.role === 'telecaller' && existingFollowUp.enquiry.assignedToUserId !== user.id) {
                return {
                    success: false,
                    message: 'Access denied',
                };
            }
            // If rescheduled date is provided, replace the scheduled date
            const finalUpdateData: Partial<{
                status: FollowUpStatus;
                outcome: string;
                notes: string;
                scheduledAt: Date;
            }> = { ...updateData };
            if (rescheduledAt) {
                finalUpdateData.scheduledAt = rescheduledAt;
                // Automatically set status to RESCHEDULED if not already set
                if (!finalUpdateData.status) {
                    finalUpdateData.status = FollowUpStatus.RESCHEDULED;
                }
            }
            const followUp = await prisma.followUp.update({
                where: { id },
                data: finalUpdateData,
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
            await invalidateDashboardCache();
            const message = rescheduledAt
                ? 'Follow-up rescheduled successfully'
                : 'Follow-up updated successfully';
            return { success: true, data: followUp, message };
        }
        catch (error) {
            console.error('Error updating follow-up:', error);
            return {
                success: false,
                message: 'Failed to update follow-up',
            };
        }
    }
    async function deleteFollowUp(id: string): Promise<ActionResponse> {
        try {
            // Check if follow-up exists and user has permission
            const existingFollowUp = await prisma.followUp.findUnique({
                where: { id },
                include: {
                    enquiry: true,
                },
            });
            if (!existingFollowUp) {
                return {
                    success: false,
                    message: 'Follow-up not found',
                };
            }
            // Only allow deletion by admin or the assigned user
            if (user.role === 'telecaller' && existingFollowUp.enquiry.assignedToUserId !== user.id) {
                return {
                    success: false,
                    message: 'Access denied',
                };
            }
            await prisma.followUp.delete({
                where: { id },
            });
            await invalidateDashboardCache();
            return { success: true, message: 'Follow-up deleted successfully' };
        }
        catch (error) {
            console.error('Error deleting follow-up:', error);
            return {
                success: false,
                message: 'Failed to delete follow-up',
            };
        }
    }
    return { createFollowUp, getFollowUps, updateFollowUp, deleteFollowUp };
}
