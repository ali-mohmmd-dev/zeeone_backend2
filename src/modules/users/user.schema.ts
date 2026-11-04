import { z } from 'zod';

export const userFilterSchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  branch: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'executive', 'telecaller']).optional(),
  branch: z.string().optional().nullable(),
  banned: z.boolean().optional(),
  banReason: z.string().optional().nullable(),
});

export const changePasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
