import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  phone: z.string().trim().max(32).optional(),
  address: z.string().trim().max(1000).optional(),
  state: z.string().trim().max(80).optional(),
  gstin: z.string().trim().max(32).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
