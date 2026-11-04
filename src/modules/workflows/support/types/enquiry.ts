import { User, Course, Branch, EnquirySource, RequiredService } from './data-management.js';
import type { EnquiryActivity } from './enquiry-activity.js';

export enum EnquiryStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  CONFIRMED = 'CONFIRMED',
  NOT_INTERESTED = 'NOT_INTERESTED',
  FOLLOW_UP = 'FOLLOW_UP',
  DROPPED = 'DROPPED',
  INVALID = 'INVALID',
}

export enum FollowUpStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RESCHEDULED = 'RESCHEDULED',
}

export interface Enquiry {
  id: string;
  candidateName: string;
  phone: string;
  contact2?: string;
  email?: string;
  address?: string;
  status: EnquiryStatus;
  notes?: string;
  feedback?: string;
  lastContactDate?: Date;

  // Relationships
  branchId?: string;
  branch?: Branch;
  preferredCourseId?: string;
  preferredCourse?: Course;
  enquirySourceId?: string;
  enquirySource?: EnquirySource;
  requiredServiceId?: string;
  requiredService?: RequiredService;
  assignedToUserId?: string;
  assignedTo?: User;
  createdByUserId?: string;
  createdBy?: User;
  assignedByUserId?: string;
  assignedBy?: User;

  // Child relationships
  followUps?: FollowUp[];
  callLogs?: CallLog[];
  activities?: EnquiryActivity[];

  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUp {
  id: string;
  scheduledAt: Date;
  status: FollowUpStatus;
  outcome?: string;
  notes?: string;

  // Relationships
  enquiryId: string;
  enquiry: Enquiry;
  createdByUserId: string;
  createdBy: User;

  createdAt: Date;
  updatedAt: Date;
}

export interface CallLog {
  id: string;
  callDate: Date;
  duration?: number; // in minutes
  outcome?: string;
  notes?: string;

  // Relationships
  enquiryId: string;
  enquiry: Enquiry;
  createdByUserId: string;
  createdBy: User;

  createdAt: Date;
  updatedAt: Date;
}

// Input types for forms
export interface CreateEnquiryInput {
  candidateName: string;
  phone: string;
  contact2?: string;
  email?: string;
  address?: string;
  notes?: string;
  branchId?: string;
  preferredCourseId?: string;
  enquirySourceId?: string;
  requiredServiceId?: string;
  assignedToUserId?: string;
  createdByUserId?: string;
}

export interface UpdateEnquiryInput {
  id: string;
  candidateName?: string;
  phone?: string;
  contact2?: string;
  email?: string;
  address?: string;
  status?: EnquiryStatus;
  notes?: string;
  feedback?: string;
  branchId?: string;
  preferredCourseId?: string;
  enquirySourceId?: string;
  requiredServiceId?: string;
}

export interface CreateFollowUpInput {
  enquiryId: string;
  scheduledAt: Date;
  notes?: string;
}

export interface UpdateFollowUpInput {
  id: string;
  status?: FollowUpStatus;
  outcome?: string;
  notes?: string;
  rescheduledAt?: Date;
}

export interface CreateCallLogInput {
  enquiryId: string;
  duration?: number;
  outcome?: string;
  notes?: string;
}

// Pagination and filter types
export interface EnquiryFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: EnquiryStatus[];
  branchId?: string;
  enquirySourceId?: string;
  assignedToUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  isAssigned?: boolean;
}

export interface FollowUpFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: FollowUpStatus[];
  branchId?: string;
  assignedToUserId?: string;
  overdue?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CallLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  outcome?: string;
  enquiryId?: string;
  assignedToUserId?: string;
  branchId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

