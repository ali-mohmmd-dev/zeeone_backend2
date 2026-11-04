import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { UserController } from './user.controller.js';
import { createAuthService } from '../workflows/auth.service.js';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // Listing users is accessible to admin and executive, telecallers can see telecallers for assignments
  fastify.get('/', UserController.listUsers);
  fastify.get('/:id', UserController.getUser);

  fastify.post('/change-password', async (request) => {
    return createAuthService(fastify.prisma, request.currentUser).changePasswordAction(request.body);
  });

  // Mutating users requires Admin
  fastify.patch('/:id', { preHandler: [requireRole(['admin'])] }, UserController.updateUser);
  fastify.post('/:id/password', { preHandler: [requireRole(['admin'])] }, UserController.changePassword);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, UserController.deleteUser);
};
