import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { CallLogFilterInput, CreateCallLogInput } from './call-log.schema.js';

export class CallLogService {
  constructor(private prisma: PrismaClient) {}

  async listCallLogs(filters: CallLogFilterInput, user: { id: string; role: string | null }) {
    const { enquiryId, outcome, startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.CallLogWhereInput = {};

    if (user.role === 'telecaller') {
      where.createdByUserId = user.id;
    }

    if (enquiryId) where.enquiryId = enquiryId;
    if (outcome) where.outcome = outcome;

    if (startDate || endDate) {
      where.callDate = {};
      if (startDate) where.callDate.gte = new Date(startDate);
      if (endDate) where.callDate.lte = new Date(endDate);
    }

    const [callLogs, total] = await Promise.all([
      this.prisma.callLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { callDate: 'desc' },
        include: {
          enquiry: {
            select: {
              id: true,
              candidateName: true,
              phone: true,
              email: true,
              status: true,
            },
          },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.callLog.count({ where }),
    ]);

    return { callLogs, total };
  }

  async createCallLog(input: CreateCallLogInput, currentUserId: string) {
    const callLog = await this.prisma.callLog.create({
      data: {
        enquiryId: input.enquiryId,
        duration: input.duration,
        outcome: input.outcome,
        notes: input.notes,
        createdByUserId: currentUserId,
      },
    });

    await this.prisma.enquiry.update({
      where: { id: input.enquiryId },
      data: { lastContactDate: new Date() },
    });

    return callLog;
  }

  async getCallStats(user: { id: string; role: string | null }) {
    const where: Prisma.CallLogWhereInput = {};
    if (user.role === 'telecaller') {
      where.createdByUserId = user.id;
    }

    const logs = await this.prisma.callLog.findMany({
      where,
      select: { duration: true, outcome: true },
    });

    const totalCalls = logs.length;
    const answeredCalls = logs.filter((l) => l.outcome && !l.outcome.toLowerCase().includes('not answered') && !l.outcome.toLowerCase().includes('busy')).length;
    const totalDuration = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
    const successRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;

    return {
      totalCalls,
      answeredCalls,
      totalDuration,
      avgDuration: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      successRate,
    };
  }

  async deleteCallLog(id: string) {
    const log = await this.prisma.callLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundError('Call log');
    return this.prisma.callLog.delete({ where: { id } });
  }
}
