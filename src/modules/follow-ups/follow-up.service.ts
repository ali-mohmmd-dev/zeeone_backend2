import { PrismaClient, Prisma, FollowUpStatus, EnquiryStatus } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { CreateFollowUpInput, FollowUpFilterInput, RescheduleFollowUpInput, UpdateFollowUpInput } from './follow-up.schema.js';

export class FollowUpService {
  constructor(private prisma: PrismaClient) {}

  async listFollowUps(filters: FollowUpFilterInput, user: { id: string; role: string | null }) {
    const { status, dateRange, enquiryId, branchId, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.FollowUpWhereInput = {};

    const enquiryConditions: Prisma.EnquiryWhereInput = {};
    if (user.role === 'telecaller') {
      enquiryConditions.assignedToUserId = user.id;
    }
    if (branchId) {
      enquiryConditions.branchId = branchId;
    }

    if (Object.keys(enquiryConditions).length > 0) {
      where.enquiry = { is: enquiryConditions };
    }

    if (enquiryId) where.enquiryId = enquiryId;
    if (status) where.status = status as FollowUpStatus;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (dateRange === 'today') {
      where.scheduledAt = { gte: startOfToday, lte: endOfToday };
    } else if (dateRange === 'upcoming') {
      where.scheduledAt = { gt: endOfToday };
      where.status = FollowUpStatus.PENDING;
    } else if (dateRange === 'overdue') {
      where.scheduledAt = { lt: startOfToday };
      where.status = FollowUpStatus.PENDING;
    }

    const [followUps, total] = await Promise.all([
      this.prisma.followUp.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          enquiry: {
            select: {
              id: true,
              candidateName: true,
              phone: true,
              email: true,
              status: true,
              preferredCourse: { select: { name: true } },
              assignedTo: { select: { id: true, name: true } },
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.followUp.count({ where }),
    ]);

    return { followUps, total };
  }

  async getFollowUpById(id: string) {
    const followUp = await this.prisma.followUp.findUnique({
      where: { id },
      include: {
        enquiry: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!followUp) throw new NotFoundError('Follow-up');
    return followUp;
  }

  async createFollowUp(input: CreateFollowUpInput, currentUserId: string) {
    const scheduledDate = new Date(input.scheduledAt);

    const followUp = await this.prisma.followUp.create({
      data: {
        enquiryId: input.enquiryId,
        scheduledAt: scheduledDate,
        notes: input.notes,
        createdByUserId: currentUserId,
      },
    });

    await this.prisma.enquiry.update({
      where: { id: input.enquiryId },
      data: { status: EnquiryStatus.FOLLOW_UP },
    });

    return followUp;
  }

  async updateFollowUp(id: string, input: UpdateFollowUpInput, _currentUserId: string) {
    await this.getFollowUpById(id);
    return this.prisma.followUp.update({
      where: { id },
      data: input,
    });
  }

  async rescheduleFollowUp(id: string, input: RescheduleFollowUpInput, _currentUserId: string) {
    await this.getFollowUpById(id);
    const newDate = new Date(input.scheduledAt);

    return this.prisma.followUp.update({
      where: { id },
      data: {
        scheduledAt: newDate,
        status: FollowUpStatus.RESCHEDULED,
        notes: input.notes,
      },
    });
  }

  async deleteFollowUp(id: string) {
    await this.getFollowUpById(id);
    return this.prisma.followUp.delete({ where: { id } });
  }
}