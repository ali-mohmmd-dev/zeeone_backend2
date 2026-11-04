import type { Prisma } from '@prisma/client';
import {
  Admission,
  AdmissionGender,
  AdmissionStatus,
  Course,
  User,
  Enquiry,
} from '@prisma/client';

// Re-export Prisma enums for easier use
export { AdmissionGender, AdmissionStatus };

// Main Admission interface with relations
export interface AdmissionWithRelations extends Admission {
  course: Course;
  enquiry?: Enquiry | null;
  createdBy: User;
}

// Form data types
export interface CreateAdmissionInput {
  candidateName: string;
  mobileNumber: string;
  email?: string;
  gender: AdmissionGender;
  dateOfBirth: Date;
  address: string;
  leadSource?: string;
  lastQualification: string;
  yearOfPassing: number;
  percentageCGPA: string;
  instituteName: string;
  additionalNotes?: string;
  courseId: string;
  enquiryId?: string;
}

// Database creation data type (for Prisma operations)
export interface AdmissionCreateData {
  admissionNumber: string;
  candidateName: string;
  mobileNumber: string;
  email: string | null;
  gender: AdmissionGender | null;
  dateOfBirth: Date | null;
  address: string;
  leadSource: string | null;
  lastQualification: string | null;
  yearOfPassing: number | null;
  percentageCGPA: string | null;
  instituteName: string | null;
  additionalNotes: string | null;
  agentName?: string ;
  agentCommission?: Prisma.Decimal.Value;
  status: AdmissionStatus;
  createdAt: Date;
  handledBy?: { connect: { id: string } };
  assignedTo: { connect: { id: string } };
  course: {
    connect: { id: string };
  };
  createdBy: {
    connect: { id: string };
  };
  enquiry?: {
    connect: { id: string };
  };
  balance: Prisma.Decimal.Value;
}

export interface UpdateAdmissionInput {
  id: string;
  candidateName?: string;
  mobileNumber?: string;
  email?: string;
  gender?: AdmissionGender;
  dateOfBirth?: Date;
  address?: string;
  leadSource?: string;
  lastQualification?: string;
  yearOfPassing?: number;
  percentageCGPA?: string;
  instituteName?: string;
  additionalNotes?: string;
  courseId?: string;

  status?: AdmissionStatus;
  enquiryId?: string;
}

// Multi-step form data (used in components)
export interface AdmissionFormData {
  id?: string;
  enquiryId: string;
  courseId: string;
  createdById: string;
}

// Filter and search types
export interface AdmissionFilters {
  search?: string;
  status?: AdmissionStatus;
  courseId?: string;
  gender?: AdmissionGender;
  leadSource?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  page?: number;
  limit?: number;
}



// API response types
export interface AdmissionListResponse {
  admissions: AdmissionWithRelations[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface CreateAdmissionResponse {
  success: boolean;
  admission?: AdmissionWithRelations;
  error?: string;
}

export interface UpdateAdmissionResponse {
  success: boolean;
  admission?: AdmissionWithRelations;
  error?: string;
}


// Dashboard summary types
export interface AdmissionStats {
  totalAdmissions: number;
  pendingAdmissions: number;
  confirmedAdmissions: number;
  completedAdmissions: number;
}

// Table column types for data tables
export interface AdmissionTableRow {
  id: string;
  admissionNumber: string;
  candidateName: string;
  mobileNumber: string;
  courseName: string;
  status: AdmissionStatus;
  createdAt: Date;
}

// Form validation schemas helper types
export interface AdmissionValidationErrors {
  candidateName?: string;
  mobileNumber?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  leadSource?: string;
  lastQualification?: string;
  yearOfPassing?: string;
  percentageCGPA?: string;
  instituteName?: string;
  courseId?: string;
}

// Status display helpers
export const AdmissionStatusLabels: Record<AdmissionStatus, string> = {
  [AdmissionStatus.PENDING]: 'Pending',
  [AdmissionStatus.CONFIRMED]: 'Confirmed',
  [AdmissionStatus.COMPLETED]: 'Completed',
  [AdmissionStatus.CANCELLED]: 'Cancelled',
};



export const AdmissionGenderLabels: Record<AdmissionGender, string> = {
  [AdmissionGender.MALE]: 'Male',
  [AdmissionGender.FEMALE]: 'Female',
  [AdmissionGender.OTHER]: 'Other',
};
