import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { z } from 'zod';
import { ActivityType, type EnquiryActivity } from './support/types/enquiry-activity.js';
export function createEnquiryActivityActionsService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const workflowSession = { user: currentUser, session: { id: currentUser.id, userId: currentUser.id } };
    async function getCurrentUser() {
        const session = workflowSession;
        if (!session) {
            throw new Error('Unauthorized');
        }
        return session.user;
    }
    const getActivitiesSchema = z.object({
        enquiryId: z.string().min(1, 'Enquiry ID is required'),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        type: z.array(z.nativeEnum(ActivityType)).optional(),
    });
    const getEnquiryActivitiesSchema = getActivitiesSchema;
    async function getEnquiryActivities(input: unknown) {
        const parsedInput = getEnquiryActivitiesSchema.parse(input ?? {});
        try {
            const user = await getCurrentUser();
            const { enquiryId, page, limit, type } = parsedInput;
            const skip = (page - 1) * limit;
            // Build where clause
            const where: Record<string, unknown> = {
                enquiryId,
            };
            if (type && type.length > 0) {
                where.type = { in: type };
            }
            // Role-based filtering - check if user has access to this enquiry
            if (user.role === 'telecaller') {
                const enquiry = await prisma.enquiry.findUnique({
                    where: { id: enquiryId },
                    select: { assignedToUserId: true },
                });
                if (!enquiry || enquiry.assignedToUserId !== user.id) {
                    throw new Error('Access denied');
                }
            }
            const [followUps, callLogs] = await Promise.all([
                prisma.followUp.findMany({
                    where: { enquiryId },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    include: {
                        createdBy: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                        enquiry: {
                            select: { id: true, candidateName: true, status: true },
                        },
                    },
                }),
                prisma.callLog.findMany({
                    where: { enquiryId },
                    orderBy: { callDate: 'desc' },
                    take: limit,
                    include: {
                        createdBy: {
                            select: { id: true, name: true, email: true, role: true },
                        },
                        enquiry: {
                            select: { id: true, candidateName: true, status: true },
                        },
                    },
                }),
            ]);
            const activities: EnquiryActivity[] = [
                ...followUps.map((f) => ({
                    id: f.id,
                    type: ActivityType.FOLLOW_UP,
                    title: `Follow-up scheduled (${f.status})`,
                    description: f.notes || f.outcome || 'Follow-up created',
                    enquiryId: f.enquiryId,
                    followUpId: f.id,
                    callLogId: null,
                    createdByUserId: f.createdByUserId,
                    createdAt: f.createdAt,
                    createdBy: f.createdBy,
                    enquiry: f.enquiry,
                    followUp: {
                        id: f.id,
                        scheduledAt: f.scheduledAt,
                        status: f.status,
                        outcome: f.outcome,
                    },
                    callLog: null,
                })),
                ...callLogs.map((c) => ({
                    id: c.id,
                    type: ActivityType.CALL_LOG,
                    title: `Call logged - ${c.outcome || 'Completed'}`,
                    description: c.notes || `Duration: ${c.duration || 0}s`,
                    enquiryId: c.enquiryId,
                    followUpId: null,
                    callLogId: c.id,
                    createdByUserId: c.createdByUserId,
                    createdAt: c.createdAt,
                    createdBy: c.createdBy,
                    enquiry: c.enquiry,
                    followUp: null,
                    callLog: {
                        id: c.id,
                        callDate: c.callDate,
                        duration: c.duration,
                        outcome: c.outcome,
                    },
                })),
            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const total = activities.length;
            const paginatedActivities = activities.slice(skip, skip + limit);
            const pagination = {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1,
            };
            return {
                success: true,
                data: paginatedActivities,
                pagination,
                message: 'Activities fetched successfully',
            };
        }
        catch (error) {
            console.error('Error fetching enquiry activities:', error);
            throw new Error('Failed to fetch activities');
        }
    }
    return { getEnquiryActivities };
}
