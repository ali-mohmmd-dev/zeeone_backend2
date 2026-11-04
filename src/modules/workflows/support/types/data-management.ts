import type { Prisma } from '@prisma/client';
export interface Role {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Course {
  id: string;
  name: string;
  description?: string;
  duration?: string;
  courseFee?: Prisma.Decimal.Value | null;
  admissionFee?: Prisma.Decimal.Value | null;
  semesterFee?: Prisma.Decimal.Value | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  name: string;
  price: Prisma.Decimal.Value;
  createdAt: Date;
  updatedAt: Date;
}

export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnquirySource {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequiredService {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: Role;
  branch?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Form types
export interface CreateRoleInput {
  name: string;
  description?: string;
}

export interface UpdateRoleInput extends CreateRoleInput {
  id: string;
}

export interface CreateCourseInput {
  name: string;
  description?: string;
  duration?: string;
  courseFee?: Prisma.Decimal.Value | null;
  admissionFee?: Prisma.Decimal.Value | null;
  semesterFee?: Prisma.Decimal.Value | null;
}

export interface UpdateCourseInput extends CreateCourseInput {
  id: string;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface UpdateBranchInput extends CreateBranchInput {
  id: string;
}

export interface CreateEnquirySourceInput {
  name: string;
}

export interface UpdateEnquirySourceInput extends CreateEnquirySourceInput {
  id: string;
}

export interface CreateRequiredServiceInput {
  name: string;
}

export interface UpdateRequiredServiceInput extends CreateRequiredServiceInput {
  id: string;
}


export interface CreateServiceInput {
  name: string;
  price: Prisma.Decimal.Value;
}

export interface UpdateServiceInput extends CreateServiceInput {
  id: string;
}


export interface DeleteInput {
  id: string;
}