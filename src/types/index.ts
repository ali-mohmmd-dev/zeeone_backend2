import { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from '../modules/workflows/workflow-user.js';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string | null;
  branch: string | null;
  permissions?: string[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserPayload;
    user: UserPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: WorkflowUser;
  }
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
