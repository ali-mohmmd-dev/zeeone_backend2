import { z } from 'zod';

export const jobOrderFilterSchema = z.object({
  branchId: z.string().optional(),
  managerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createJobOrderSchema = z.object({
  jobCode: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  managerId: z.string().min(1, 'Manager ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
});

export const assignJobLeadsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, 'At least one lead ID is required'),
  assigneeId: z.string().optional().nullable(),
});

export const updateJobLeadStatusSchema = z.object({
  status: z.enum(['PENDING', 'CLOSED']),
  assigneeId: z.string().optional().nullable(),
});

export type JobOrderFilterInput = z.infer<typeof jobOrderFilterSchema>;
export type CreateJobOrderInput = z.infer<typeof createJobOrderSchema>;
export type AssignJobLeadsInput = z.infer<typeof assignJobLeadsSchema>;
export type UpdateJobLeadStatusInput = z.infer<typeof updateJobLeadStatusSchema>;
