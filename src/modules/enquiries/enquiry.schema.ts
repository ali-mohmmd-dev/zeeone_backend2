import { z } from 'zod';
import { EnquiryStatus } from '@prisma/client';

export const enquiryFilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().transform((value) => value.split(',')).pipe(z.array(z.nativeEnum(EnquiryStatus))).optional(),
  branchId: z.string().optional(),
  assignedToUserId: z.string().optional(),
  preferredCourseId: z.string().optional(),
  serviceId: z.string().optional(),
  source: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  enquirySourceId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  isAssigned: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['createdAt', 'candidateName', 'status', 'updatedAt', 'lastContactDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createEnquirySchema = z.object({
  candidateName: z.string().min(1, 'Candidate name is required').max(100),
  phone: z.string().min(10, 'Valid phone number is required').max(15),
  contact2: z.string().optional().nullable(),
  email: z.string().email().or(z.literal('')).optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  feedback: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  sourceId: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  preferredCourseId: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  createdByUserId: z.string().min(1).optional(),
  status: z.enum([
    'NEW', 'CONTACTED', 'CONFIRMED', 'NOT_INTERESTED',
    'FOLLOW_UP', 'DROPPED', 'INVALID'
  ]).default('NEW'),
});

export const updateEnquirySchema = createEnquirySchema.omit({ createdByUserId: true, assignedToUserId: true }).partial();

export const changeEnquiryStatusSchema = z.object({
  status: z.enum([
    'NEW', 'CONTACTED', 'CONFIRMED', 'NOT_INTERESTED',
    'FOLLOW_UP', 'DROPPED', 'INVALID'
  ]),
  remarks: z.string().optional().nullable(),
});

export const addEnquiryActivitySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  type: z.string().optional(),
});

export type EnquiryFilterInput = z.infer<typeof enquiryFilterSchema>;
export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;
export type ChangeEnquiryStatusInput = z.infer<typeof changeEnquiryStatusSchema>;
export type AddEnquiryActivityInput = z.infer<typeof addEnquiryActivitySchema>;
