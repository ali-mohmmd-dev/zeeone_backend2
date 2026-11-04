import { PrismaClient, Prisma, JobLeadStatus } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { AssignJobLeadsInput, CreateJobOrderInput, JobOrderFilterInput, UpdateJobLeadStatusInput } from './job-order.schema.js';

export class JobOrderService {
  constructor(private prisma: PrismaClient) {}

  async listJobOrders(filters: JobOrderFilterInput) {
    const { branchId, managerId, startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.JobOrderWhereInput = {};
    if (branchId) where.branchId = branchId;
    if (managerId) where.managerId = managerId;

    if (startDate || endDate) {
      if (startDate) where.startDate = { gte: new Date(startDate) };
      if (endDate) where.endDate = { lte: new Date(endDate) };
    }

    const [jobOrders, total] = await Promise.all([
      this.prisma.jobOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          manager: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { jobLeads: true } },
        },
      }),
      this.prisma.jobOrder.count({ where }),
    ]);

    return { jobOrders, total };
  }

  async getJobOrderById(id: string) {
    const jobOrder = await this.prisma.jobOrder.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        assigner: { select: { id: true, name: true, email: true } },
        branch: true,
        jobLeads: {
          include: {
            lead: {
              select: {
                id: true,
                candidateName: true,
                phone: true,
                email: true,
                status: true,
              },
            },
            assignee: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!jobOrder) throw new NotFoundError('Job Order');
    return jobOrder;
  }

  async createJobOrder(input: CreateJobOrderInput, currentUserId: string) {
    return this.prisma.jobOrder.create({
      data: {
        ...input,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        assignerId: currentUserId,
      },
    });
  }

  async updateJobOrder(id: string, input: Partial<CreateJobOrderInput>) {
    await this.getJobOrderById(id);

    return this.prisma.jobOrder.update({
      where: { id },
      data: {
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
      },
    });
  }

  async deleteJobOrder(id: string) {
    await this.getJobOrderById(id);
    return this.prisma.jobOrder.delete({ where: { id } });
  }

  async assignLeads(jobId: string, input: AssignJobLeadsInput, currentUserId: string) {
    await this.getJobOrderById(jobId);

    return this.prisma.$transaction(async (tx) => {
      const records = input.leadIds.map((leadId) => ({
        jobId,
        leadId,
        assignerId: currentUserId,
        assigneeId: input.assigneeId || undefined,
        status: JobLeadStatus.PENDING,
      }));

      await tx.jobLead.createMany({ data: records });
      return { count: input.leadIds.length };
    });
  }

  async updateLeadStatus(jobLeadId: string, input: UpdateJobLeadStatusInput) {
    const jobLead = await this.prisma.jobLead.findUnique({ where: { id: jobLeadId } });
    if (!jobLead) throw new NotFoundError('Job Lead assignment');

    return this.prisma.jobLead.update({
      where: { id: jobLeadId },
      data: {
        status: input.status as JobLeadStatus,
        assigneeId: input.assigneeId,
      },
    });
  }
}
