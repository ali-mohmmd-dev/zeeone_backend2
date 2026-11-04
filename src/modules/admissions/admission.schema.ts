import { moneySchema } from '../../shared/utils/money.schemas.js';
import { z } from 'zod';

export const admissionFilterSchema = z.object({
  search: z.string().optional(),
  courseId: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createAdmissionSchema = z.object({
  candidateName: z.string().min(1, 'Candidate name is required'),
  mobileNumber: z.string().min(1, 'Mobile number is required'),
  email: z.string().email().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  dateOfBirth: z.string().or(z.date()).optional().nullable(),
  address: z.string().min(1, 'Address is required'),
  leadSource: z.string().optional().nullable(),
  lastQualification: z.string().optional().nullable(),
  yearOfPassing: z.coerce.number().optional().nullable(),
  percentageCGPA: z.string().optional().nullable(),
  instituteName: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  courseId: z.string().min(1, 'Course ID is required'),
  enquiryId: z.string().optional().nullable(),
  agentName: z.string().optional().nullable(),
  agentCommission: moneySchema.optional().nullable(),
  handledByUserId: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).default('CONFIRMED'),
  initialPayment: z.object({
    amount: moneySchema.refine((value) => value.greaterThanOrEqualTo(1), "Amount is below the minimum"),
    collectedTowards: z.enum(['ADMISSION_FEE', 'COURSE_FEE', 'SEMESTER_FEE', 'OTHER']).default('ADMISSION_FEE'),
    paymentMode: z.string().optional().nullable(),
    transactionId: z.string().optional().nullable(),
  }).optional().nullable(),
});

export const updateAdmissionSchema = z.object({
  candidateName: z.string().min(1).optional(),
  mobileNumber: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  dateOfBirth: z.string().or(z.date()).optional().nullable(),
  address: z.string().optional(),
  leadSource: z.string().optional().nullable(),
  lastQualification: z.string().optional().nullable(),
  yearOfPassing: z.coerce.number().optional().nullable(),
  percentageCGPA: z.string().optional().nullable(),
  instituteName: z.string().optional().nullable(),
  additionalNotes: z.string().optional().nullable(),
  courseId: z.string().optional(),
  agentName: z.string().optional().nullable(),
  agentCommission: moneySchema.optional().nullable(),
  handledByUserId: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  nextDueDate: z.string().or(z.date()).optional().nullable(),
});

export type AdmissionFilterInput = z.infer<typeof admissionFilterSchema>;
export type CreateAdmissionInput = z.infer<typeof createAdmissionSchema>;
export type UpdateAdmissionInput = z.infer<typeof updateAdmissionSchema>;
