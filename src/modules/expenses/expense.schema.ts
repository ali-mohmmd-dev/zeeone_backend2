import { moneySchema } from '../../shared/utils/money.schemas.js';
﻿import { z } from 'zod';

export const expenseFilterSchema = z.object({
  category: z.enum([
    'OFFICE_SUPPLIES', 'TRAVEL', 'UTILITIES', 'MARKETING',
    'MEALS', 'EQUIPMENT', 'SOFTWARE', 'OTHER'
  ]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  amount: moneySchema.refine((value) => value.greaterThanOrEqualTo(0.01), 'Amount must be greater than 0'),
  category: z.enum([
    'OFFICE_SUPPLIES', 'TRAVEL', 'UTILITIES', 'MARKETING',
    'MEALS', 'EQUIPMENT', 'SOFTWARE', 'OTHER'
  ]),
  expenseDate: z.string().or(z.date()).default(() => new Date()),
  notes: z.string().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type ExpenseFilterInput = z.infer<typeof expenseFilterSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
