import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../errors/app-error.js';

export const assignmentSchema = z.object({
  assignedToUserId: z.string().min(1),
  branchId: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;
type AssignmentUser = { id: string; role: string | null; branch: string | null };

export async function assignEnquiries(prisma: PrismaClient, user: AssignmentUser, enquiryIds: string[], input: AssignmentInput) {
  if (!['admin', 'manager', 'executive', 'branch manager'].includes((user.role || '').toLowerCase())) {
    throw new ForbiddenError('You cannot assign enquiries');
  }
  const ids = [...new Set(z.array(z.string().min(1)).min(1).max(5000).parse(enquiryIds))];
  const data = assignmentSchema.parse(input);
  if (user.role !== 'admin' && (!user.branch || user.branch !== data.branchId)) {
    throw new ForbiddenError('You can only assign enquiries within your branch');
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (data.startDate < today) throw new BadRequestError('Start date cannot be in the past');
  if (data.startDate > data.endDate) throw new BadRequestError('Start date cannot be after end date');

  return prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findUnique({ where: { id: data.branchId } });
    if (!branch || !branch.isActive) throw new NotFoundError('Active branch');
    const assignee = await tx.user.findUnique({ where: { id: data.assignedToUserId } });
    if (!assignee || assignee.banned) throw new NotFoundError('Active assignee');
    if (assignee.branch !== data.branchId) throw new BadRequestError('Assignee must belong to the selected branch');

    const where = { id: { in: ids }, ...(user.role !== 'admin' ? { branchId: user.branch } : {}) };
    const enquiries = await tx.enquiry.findMany({ where, select: { id: true } });
    if (enquiries.length !== ids.length) throw new ForbiddenError('Some enquiries are missing or outside your branch');

    const updated = await tx.enquiry.updateMany({
      where,
      data: { assignedToUserId: assignee.id, assignedByUserId: user.id, branchId: data.branchId, lastContactDate: new Date() },
    });
    if (updated.count !== ids.length) throw new BadRequestError('The enquiries changed. Please try again.');
    const job = await tx.jobOrder.create({
      data: { name: data.name, description: data.description, remarks: data.remarks, managerId: assignee.id, assignerId: user.id, branchId: data.branchId, startDate: data.startDate, endDate: data.endDate },
    });
    await tx.jobLead.createMany({
      data: ids.map(id => ({ jobId: job.id, leadId: id, status: 'PENDING' as const, assignerId: user.id, assigneeId: assignee.id })),
    });
    if (assignee.id !== user.id) {
      await tx.notification.create({
        data: { userId: assignee.id, title: 'Enquiries Assigned', message: `You have been assigned ${ids.length} enquiries.`, type: 'ENQUIRY_ASSIGNED', link: `/enquiries/job-orders/${job.id}` },
      });
    }
    return { count: updated.count, jobOrderId: job.id };
  });
}
