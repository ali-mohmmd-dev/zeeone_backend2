import type { User, Role } from '@prisma/client';

export type WorkflowUser = Omit<User, 'password'> & {
  userRole: Role | null;
  permissions?: string[];
};
