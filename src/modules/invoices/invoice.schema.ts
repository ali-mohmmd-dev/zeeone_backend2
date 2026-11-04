import { moneySchema, taxRateSchema } from '../../shared/utils/money.schemas.js';
﻿import { z } from 'zod';

export const invoiceFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const invoiceItemInputSchema = z.object({
  itemDescription: z.string().min(1, 'Item description is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unitPrice: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Unit price cannot be negative'),
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(64).optional(),
  billedTo: z.string().min(1, 'Billed to information is required'),
  customerId: z.string().nullable().optional(),
  invoiceDate: z.string().or(z.date()).default(() => new Date()),
  dueDate: z.string().or(z.date()).optional().nullable(),
  taxRate: taxRateSchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").refine((value) => value.lessThanOrEqualTo(1), "Amount exceeds the maximum").default(0.18),
  discountAmount: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").default(0),
  withholdingAmount: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").default(0),
  withholdingType: z.enum(['TDS', 'TCS']).optional().nullable(),
  serviceCharge: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").default(0),
  otherCharges: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").default(0),
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']).default('DRAFT'),
  notes: z.string().optional().nullable(),
  items: z.array(invoiceItemInputSchema).min(1, 'At least one invoice item is required'),
  initialPayment: z.object({
    amount: moneySchema.refine((value) => value.greaterThan(0), 'Amount must be greater than zero'),
    paymentNumber: z.string().trim().max(64).optional(),
    paymentDate: z.string().or(z.date()),
    paymentMode: z.string().trim().min(1).max(40),
    depositTo: z.string().trim().max(120).optional().nullable(),
    referenceNumber: z.string().trim().max(120).optional().nullable(),
  }).optional(),
});

export const createPaymentSchema = z.object({
  amount: moneySchema.refine((value) => value.greaterThan(0), 'Amount must be greater than zero'),
  paymentNumber: z.string().trim().max(64).optional(),
  paymentDate: z.string().or(z.date()).default(() => new Date()),
  paymentMode: z.string().trim().min(1).max(40),
  depositTo: z.string().trim().max(120).optional().nullable(),
  referenceNumber: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const paymentSettingsSchema = z.object({
  autoGenerate: z.boolean(),
  prefix: z.string().trim().min(1).max(20),
  nextNumber: z.coerce.number().int().min(1),
  padding: z.coerce.number().int().min(1).max(12),
  restartEachFiscalYear: z.boolean(),
  lastResetFiscalYear: z.number().int().nullable().optional(),
});

export const reminderSettingsSchema = z.object({
  remindersEnabled: z.boolean(),
  reminderRules: z.array(z.string().regex(/^(before|on|after):\d+$/)).max(10),
});

export const sendInvoiceSchema = z.object({ email: z.string().email().max(254).optional() });

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;
