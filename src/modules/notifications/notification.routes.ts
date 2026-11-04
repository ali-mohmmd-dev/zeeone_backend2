import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { NotificationController } from './notification.controller.js';

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', NotificationController.listNotifications);
  fastify.patch('/:id/read', NotificationController.markAsRead);
  fastify.post('/read-all', NotificationController.markAllAsRead);
};
