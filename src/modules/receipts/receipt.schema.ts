import { moneySchema } from '../../shared/utils/money.schemas.js';
﻿import { z } from 'zod';

export const receiptFilterSchema = z.object({
  admissionId: z.string().optional(),
  courseId: z.string().optional(),
  paymentMode: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createReceiptSchema = z.object({
  admissionId: z.string().min(1, 'Admission ID is required'),
  courseId: z.string().min(1, 'Course ID is required'),
  amountCollected: moneySchema.refine((value) => value.greaterThanOrEqualTo(1), 'Amount collected must be greater than 0'),
  collectedTowards: z.enum(['ADMISSION_FEE', 'COURSE_FEE', 'SEMESTER_FEE', 'OTHER']).default('COURSE_FEE'),
  paymentDate: z.string().or(z.date()).default(() => new Date()),
  paymentMode: z.string().optional().nullable(),
  transactionId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  nextDueDate: z.string().or(z.date()).optional().nullable(),
});

export type ReceiptFilterInput = z.infer<typeof receiptFilterSchema>;
export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
