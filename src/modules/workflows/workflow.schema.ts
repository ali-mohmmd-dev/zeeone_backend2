import { moneySchema } from '../../shared/utils/money.schemas.js';
import { z } from 'zod';
import { CollectedTowards } from './support/types/fee-collection.js';
import { FollowUpStatus, EnquiryStatus } from './support/types/enquiry.js';

export const idInput = z.object({ id: z.string().min(1) });
export const roleInput = z.object({ name: z.string().trim().min(1), description: z.string().optional() });
export const courseInput = z.object({
  name: z.string().trim().min(1), description: z.string().optional(), duration: z.string().optional(),
  courseFee: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Amount cannot be negative').nullable().optional(),
  admissionFee: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Amount cannot be negative').nullable().optional(),
  semesterFee: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Amount cannot be negative').nullable().optional(),
});
export const branchInput = z.object({ name: z.string().trim().min(1), address: z.string().optional(), phone: z.string().optional(), email: z.string().email().or(z.literal('')).optional() });
export const sourceInput = z.object({ name: z.string().trim().min(1) });
export const serviceInput = z.object({ name: z.string().trim().min(1), price: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Amount cannot be negative') });

export const createFollowUpInput = z.object({ enquiryId: z.string().min(1), scheduledAt: z.coerce.date(), notes: z.string().optional() });
export const updateFollowUpInput = z.object({ id: z.string().min(1), status: z.nativeEnum(FollowUpStatus).optional(), outcome: z.string().optional(), notes: z.string().optional(), rescheduledAt: z.coerce.date().optional() });
export const createCallLogInput = z.object({ enquiryId: z.string().min(1), duration: z.number().finite().nonnegative().optional(), outcome: z.string().optional(), notes: z.string().optional() });

const listFilters = z.object({
  page: z.number().int().min(1).optional(), limit: z.number().int().min(1).max(100).optional(),
  search: z.string().optional(), sortBy: z.string().optional(), sortOrder: z.enum(['asc', 'desc']).optional(),
  branchId: z.string().optional(), assignedToUserId: z.string().optional(),
  dateFrom: z.coerce.date().optional(), dateTo: z.coerce.date().optional(),
});
export const followUpFilters = listFilters.extend({ status: z.array(z.nativeEnum(FollowUpStatus)).optional(), overdue: z.boolean().optional() });
export const callLogFilters = listFilters.extend({ enquiryId: z.string().optional(), outcome: z.string().optional() });
export const jobOrderFilters = listFilters.extend({ managerId: z.string().optional(), pendingOnly: z.boolean().optional(), completedOnly: z.boolean().optional(), dueOnly: z.boolean().optional() });

export const createJobOrderInput = z.object({
  managerId: z.string().min(1), branchId: z.string().min(1), startDate: z.coerce.date(), endDate: z.coerce.date(),
  enquiryIds: z.array(z.string().min(1)).min(1).max(5000), name: z.string().trim().min(1), description: z.string().nullable().optional(), remarks: z.string().nullable().optional(),
});

export const createReceiptInput = z.object({
  receiptNumber: z.string().min(1), amountCollected: moneySchema.refine((value) => value.greaterThan(0), 'Amount must be greater than zero'), collectedTowards: z.nativeEnum(CollectedTowards),
  paymentDate: z.coerce.date(), nextDueDate: z.coerce.date(), paymentMode: z.string().min(1), transactionId: z.string().optional(), notes: z.string().optional(), admissionId: z.string().min(1), courseId: z.string().min(1),
});
export const updateReceiptInput = createReceiptInput.omit({ admissionId: true, courseId: true }).partial().extend({ id: z.string().min(1), paymentDate: z.coerce.date(), nextDueDate: z.coerce.date() });

export const createServiceBillingInput = z.object({ serviceIds: z.array(z.string().min(1)).min(1), billDate: z.coerce.date(), admissionId: z.string().min(1), paymentMode: z.string().optional(), paid: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Amount cannot be negative').optional() });
export const updateServiceBillingInput = z.object({ id: z.string().min(1), serviceIds: z.array(z.string().min(1)).min(1).optional() });
export const payServiceBillingInput = z.object({ id: z.string().min(1), paid: moneySchema.refine((value) => value.greaterThan(0), 'Amount must be greater than zero'), paymentMode: z.string().optional() });

export const customerQueryInput = z.object({ id: z.string().optional(), name: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), sourceType: z.string().optional() });
export const enquiryStatusInput = z.nativeEnum(EnquiryStatus);
export const importLeadsInput = z.array(z.object({
  candidateName: z.string().optional(), phone: z.union([z.string(), z.number()]).optional(), email: z.string().optional(),
  address: z.string().optional(), notes: z.string().optional(),
  'Candidate Name': z.string().optional(), Name: z.string().optional(), Phone: z.union([z.string(), z.number()]).optional(), Mobile: z.union([z.string(), z.number()]).optional(),
  Email: z.string().optional(), Address: z.string().optional(), Notes: z.string().optional(),
})).min(1).max(5000);
export const importCommonFields = z.object({ branchId: z.string().min(1), enquirySourceId: z.string().optional() });
