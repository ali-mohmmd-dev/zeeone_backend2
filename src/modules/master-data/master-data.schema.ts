import { moneySchema } from '../../shared/utils/money.schemas.js';
﻿import { z } from 'zod';

export const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const courseSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  description: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  courseFee: moneySchema.optional().nullable(),
  admissionFee: moneySchema.optional().nullable(),
  semesterFee: moneySchema.optional().nullable(),
  isActive: z.boolean().default(true),
});

export const nameOnlySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().default(true),
});

export type BranchInput = z.infer<typeof branchSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type NameOnlyInput = z.infer<typeof nameOnlySchema>;
