import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { ServiceController } from './service.controller.js';

export const serviceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', ServiceController.listServices);
  fastify.post('/', { preHandler: [requireRole(['admin', 'executive'])] }, ServiceController.createService);
  fastify.patch('/:id', { preHandler: [requireRole(['admin', 'executive'])] }, ServiceController.updateService);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, ServiceController.deleteService);
};
