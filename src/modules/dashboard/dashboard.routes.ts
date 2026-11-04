import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { DashboardController } from './dashboard.controller.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/stats', DashboardController.getStats);
  fastify.get('/activities', DashboardController.getActivities);
};
