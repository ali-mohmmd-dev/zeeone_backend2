import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { AuthController } from './auth.controller.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login', AuthController.login);
  fastify.post('/logout', AuthController.logout);
  
  // Registration is restricted to Admins
  fastify.post('/register', { preHandler: [authenticate, requireRole(['admin'])] }, AuthController.register);

  // Authenticated Profile
  fastify.get('/me', { preHandler: [authenticate] }, AuthController.getMe);
};
