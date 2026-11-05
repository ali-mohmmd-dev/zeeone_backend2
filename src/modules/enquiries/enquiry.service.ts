import { PrismaClient, Prisma, NotificationType } from '@prisma/client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../errors/app-error.js';
import { ChangeEnquiryStatusInput, CreateEnquiryInput, EnquiryFilterInput, UpdateEnquiryInput } from './enquiry.schema.js';
export class EnquiryService {
    constructor(private prisma: PrismaClient) { }
    async listEnquiries(filters: EnquiryFilterInput, user: {
        id: string;
        role: string | null;
        branch: string | null;
    }) {
        const { search, status, branchId, assignedToUserId, preferredCourseId, serviceId, source, startDate, endDate, page, limit, } = filters;
        const skip = (page - 1) * limit;
        const where: Prisma.EnquiryWhereInput = {};
        // Keep access restrictions separate so user filters cannot replace them.
        const access: Prisma.EnquiryWhereInput = {};
        const role = (user.role || '').toLowerCase();
        if (role === 'manager' || role === 'executive' || role === 'branch manager') {
            if (user.branch)
                access.branchId = user.branch;
            else
                access.id = { in: [] };
        }
        else if (role !== 'admin') {
            access.assignedToUserId = user.id;
        }
        where.AND = [access];
        if (assignedToUserId && assignedToUserId !== 'all')
            where.assignedToUserId = assignedToUserId;
        if (filters.isAssigned !== undefined) {
            where.AND.push({ assignedToUserId: filters.isAssigned === 'true' ? { not: null } : null });
        }
        if (status)
            where.status = { in: status };
        if (branchId && branchId !== 'all')
            where.branchId = branchId;
        if (preferredCourseId)
            where.preferredCourseId = preferredCourseId;
        if (serviceId)
            where.serviceId = serviceId;
        if (source)
            where.source = { contains: source, mode: 'insensitive' };
        if (filters.enquirySourceId && filters.enquirySourceId !== 'all') {
            where.AND.push({ OR: [{ sourceId: filters.enquirySourceId }, { source: filters.enquirySourceId }] });
        }
        const from = filters.dateFrom || startDate;
        const to = filters.dateTo || endDate;
        if (from || to) {
            where.createdAt = {};
            if (from)
                where.createdAt.gte = new Date(from);
            if (to)
                where.createdAt.lte = new Date(to);
        }
        if (search?.trim()) {
            const term = search.trim();
            where.OR = [
                { candidateName: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
            ];
        }
        const [enquiries, total] = await Promise.all([
            this.prisma.enquiry.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [filters.sortBy]: filters.sortOrder },
                include: {
                    branch: { select: { id: true, name: true } },
                    preferredCourse: { select: { id: true, name: true } },
                    service: { select: { id: true, name: true, price: true } },
                    enquirySource: { select: { id: true, name: true } },
                    assignedTo: { select: { id: true, name: true, email: true, role: true } },
                    assignedBy: { select: { id: true, name: true, email: true, role: true } },
                    createdBy: { select: { id: true, name: true } },
                    _count: {
                        select: {
                            followUps: true,
                            callLogs: true,
                        },
                    },
                },
            }),
            this.prisma.enquiry.count({ where }),
        ]);
        return {
            enquiries: enquiries.map((enquiry) => ({
                ...enquiry,
                enquirySource: enquiry.enquirySource || (enquiry.source ? { id: enquiry.source, name: enquiry.source } : null),
                requiredService: enquiry.service,
            })),
            total,
        };
    }
    async getEnquiryById(id: string) {
        const enquiry = await this.prisma.enquiry.findUnique({
            where: { id },
            select: {
                id: true,
                candidateName: true,
                phone: true,
                contact2: true,
                email: true,
                address: true,
                status: true,
                notes: true,
                feedback: true,
                lastContactDate: true,
                branchId: true,
                preferredCourseId: true,
                serviceId: true,
                source: true,
                sourceId: true,
                assignedToUserId: true,
                createdByUserId: true,
                assignedByUserId: true,
                createdAt: true,
                updatedAt: true,
                branch: { select: { id: true, name: true } },
                preferredCourse: { select: { id: true, name: true, courseFee: true } },
                service: { select: { id: true, name: true, price: true } },
                enquirySource: { select: { id: true, name: true } },
                assignedTo: { select: { id: true, name: true, email: true, role: true } },
                createdBy: { select: { id: true, name: true, email: true, role: true } },
                assignedBy: { select: { id: true, name: true, email: true, role: true } },
            },
        });
        if (!enquiry)
            throw new NotFoundError('Enquiry');
        return enquiry;
    }
    async createEnquiry(input: CreateEnquiryInput, user: {
        id: string;
        role: string | null;
        branch: string | null;
    }, logStep?: (step: string, fields?: Record<string, unknown>) => void) {
        const role = (user.role || '').toLowerCase();
        const branchScoped = ['telecaller', 'executive', 'manager', 'branch manager'].includes(role);
        const rawBranchId = input.branchId?.trim() || null;
        const branchId = branchScoped && user.branch ? user.branch : rawBranchId;
        logStep?.('scope_resolved', { hasBranch: Boolean(branchId), role: user.role });
        if (!branchId)
            throw new BadRequestError('Branch is required');

        const preferredCourseId = input.preferredCourseId?.trim() || null;
        const serviceId = input.serviceId?.trim() || null;
        const sourceId = input.sourceId?.trim() || null;
        const assignedToUserId = input.assignedToUserId?.trim() || (role === 'telecaller' ? user.id : null);

        if (assignedToUserId && assignedToUserId !== user.id) {
            const assignee = await this.prisma.user.findUnique({ where: { id: assignedToUserId }, select: { isActive: true, banned: true } });
            if (!assignee || assignee.isActive === false || assignee.banned) throw new BadRequestError('Select an active assignee');
        }
        logStep?.('database_insert_started');
        const enquiry = await this.prisma.enquiry.create({
            data: {
                ...input,
                branchId,
                email: input.email?.trim() || null,
                contact2: input.contact2?.trim() || null,
                address: input.address?.trim() || null,
                notes: input.notes?.trim() || null,
                feedback: input.feedback?.trim() || null,
                source: input.source?.trim() || null,
                sourceId,
                serviceId,
                preferredCourseId,
                createdByUserId: input.createdByUserId?.trim() || user.id,
                assignedToUserId,
                assignedByUserId: assignedToUserId ? user.id : null,
            },
        });
        logStep?.('database_insert_succeeded', { recordId: enquiry.id });

        if (assignedToUserId) {
            try {
                logStep?.('assignment_notification_started');
                await this.prisma.notification.create({
                    data: {
                        userId: assignedToUserId,
                        title: 'New Enquiry Assigned',
                        message: `You have been assigned enquiry: ${enquiry.candidateName}`,
                        type: NotificationType.ENQUIRY_ASSIGNED,
                        link: `/enquiries/${enquiry.id}`,
                    },
                });
                logStep?.('assignment_notification_succeeded');
            } catch (notifErr) {
                logStep?.('assignment_notification_failed', { err: String(notifErr) });
            }
        }
        return enquiry;
    }
    async updateEnquiry(id: string, input: UpdateEnquiryInput, user: {
        id: string;
        role: string | null;
    }) {
        const enquiry = await this.getEnquiryById(id);
        if ((user.role || '').toLowerCase() === 'telecaller' && enquiry.assignedToUserId !== user.id) {
            throw new ForbiddenError('Access denied');
        }
        return this.prisma.enquiry.update({
            where: { id },
            data: { ...input, email: input.email === '' ? null : input.email },
        });
    }
    async deleteEnquiry(id: string, user: {
        id: string;
        role: string | null;
    }) {
        const enquiry = await this.getEnquiryById(id);
        const role = (user.role || '').toLowerCase();
        if (role === 'telecaller' && enquiry.assignedToUserId !== user.id) {
            throw new ForbiddenError('You can only delete enquiries assigned to you');
        }
        if (role === 'executive' && enquiry.createdByUserId !== user.id && enquiry.assignedToUserId !== user.id) {
            throw new ForbiddenError('You can only delete enquiries you created or are assigned to');
        }

        // Safely detach any linked admissions before deleting
        await this.prisma.admission.updateMany({
            where: { enquiryId: id },
            data: { enquiryId: null },
        });

        // Delete cascade relations if any remain
        await this.prisma.jobLead.deleteMany({ where: { leadId: id } });
        await this.prisma.followUp.deleteMany({ where: { enquiryId: id } });
        await this.prisma.callLog.deleteMany({ where: { enquiryId: id } });

        return this.prisma.enquiry.delete({ where: { id } });
    }
    async changeStatus(id: string, input: ChangeEnquiryStatusInput, _currentUserId: string) {
        await this.getEnquiryById(id);
        return this.prisma.enquiry.update({
            where: { id },
            data: {
                status: input.status,
                lastContactDate: new Date(),
                notes: input.remarks ? input.remarks : undefined,
            },
        });
    }
    // Unified timeline from follow-ups and call logs
    async listActivities(enquiryId: string) {
        const [followUps, callLogs] = await Promise.all([
            this.prisma.followUp.findMany({
                where: { enquiryId },
                orderBy: { scheduledAt: 'desc' },
                include: { createdBy: { select: { id: true, name: true } } },
            }),
            this.prisma.callLog.findMany({
                where: { enquiryId },
                orderBy: { callDate: 'desc' },
                include: { createdBy: { select: { id: true, name: true } } },
            }),
        ]);
        const activities = [
            ...followUps.map((f) => ({
                id: f.id,
                type: 'FOLLOW_UP',
                title: `Follow-up: ${f.status}`,
                description: f.notes || f.outcome || '',
                createdAt: f.createdAt,
                scheduledAt: f.scheduledAt,
                createdBy: f.createdBy,
            })),
            ...callLogs.map((c) => ({
                id: c.id,
                type: 'CALL_LOG',
                title: `Call (${c.duration || 0} mins)`,
                description: c.notes || c.outcome || '',
                createdAt: c.callDate,
                createdBy: c.createdBy,
            })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return activities;
    }
}
