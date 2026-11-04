import { z } from 'zod';

export const followUpFilterSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
  dateRange: z.enum(['all', 'today', 'upcoming', 'overdue']).default('all'),
  enquiryId: z.string().optional(),
  branchId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createFollowUpSchema = z.object({
  enquiryId: z.string().min(1, 'Enquiry ID is required'),
  scheduledAt: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
});

export const updateFollowUpSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).optional(),
  outcome: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const rescheduleFollowUpSchema = z.object({
  scheduledAt: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
});

export type FollowUpFilterInput = z.infer<typeof followUpFilterSchema>;
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
export type RescheduleFollowUpInput = z.infer<typeof rescheduleFollowUpSchema>;
