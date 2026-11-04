import type { User, Role, Branch } from '@prisma/client';

export type UserWithRole = User & {
  userRole?: Role | null;
};

// Form-related types
export interface UserFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  branch: string;
  permissions?: string[];
}

export interface UserFormProps {
  roles: Role[];
  branches: Branch[];
  onSuccess?: () => void;
  initialData?: Partial<UserFormData>;
}

// Table and UI component types
export interface UsersTableProps {
  users: UserWithRole[];
  roles: Role[];
  branches: Branch[];
}

// User profile for navigation/display purposes
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string | null;
  branch?: string | null;
  userRole?: Role | null;
}

export interface RoleConfig {
  name: string;
  description: string;
  permissions?: string[];
}
