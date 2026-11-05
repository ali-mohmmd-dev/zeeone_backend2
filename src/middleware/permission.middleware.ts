import { FastifyReply, FastifyRequest } from 'fastify';
import { hasFeatureAccess } from '../modules/workflows/support/lib/permissions.js';
import type { FeatureKey } from '../modules/workflows/support/constants/permissions.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

export function requireRole(allowedRoles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const userRole = request.user.role || 'telecaller';

    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenError(`Access denied. Requires one of roles: ${allowedRoles.join(', ')}`);
    }
  };
}

export function requireFeature(feature: FeatureKey) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError('Authentication required');
    if (!hasFeatureAccess(request.user, feature)) throw new ForbiddenError('Access denied');
  };
}
