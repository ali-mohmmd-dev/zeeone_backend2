// Activity types for the enquiry module

// Use our own ActivityType enum that matches Prisma's
export enum ActivityType {
  STATUS_CHANGE = 'STATUS_CHANGE',
  FOLLOW_UP = 'FOLLOW_UP',
  CALL_LOG = 'CALL_LOG',
  ENROLLMENT_DIRECT = 'ENROLLMENT_DIRECT',
}

// EnquiryActivity interface
export interface EnquiryActivity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  statusRemarks?: string | null;
  enquiryId: string;
  followUpId?: string | null;
  callLogId?: string | null;
  createdByUserId: string;
  createdAt: Date;

  // Relations
  createdBy: {
    id: string;
    name: string;
    email: string;
    role: string | null;
  };
  enquiry: {
    id: string;
    candidateName: string;
    status: string;
  };
  followUp?: {
    id: string;
    scheduledAt: Date;
    status: string;
    outcome: string | null;
  } | null;
  callLog?: {
    id: string;
    callDate: Date;
    duration: number | null;
    outcome: string | null;
  } | null;
}

// Input types for creating activities
export interface CreateActivityInput {
  enquiryId: string;
  type: ActivityType;
  title?: string;
  description?: string;
  previousStatus?: string;
  newStatus?: string;
  statusRemarks?: string;
  followUpId?: string;
  callLogId?: string;
}

// Filter interface for activities
export interface ActivityFilters {
  page?: number;
  limit?: number;
  type?: ActivityType[];
  enquiryId?: string;
  createdByUserId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}