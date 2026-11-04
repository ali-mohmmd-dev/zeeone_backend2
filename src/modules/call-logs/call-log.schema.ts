import { z } from 'zod';

export const callLogFilterSchema = z.object({
  enquiryId: z.string().optional(),
  outcome: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createCallLogSchema = z.object({
  enquiryId: z.string().min(1, 'Enquiry ID is required'),
  duration: z.coerce.number().optional().nullable(),
  outcome: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CallLogFilterInput = z.infer<typeof callLogFilterSchema>;
export type CreateCallLogInput = z.infer<typeof createCallLogSchema>;
