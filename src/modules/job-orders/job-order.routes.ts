import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { JobOrderController } from './job-order.controller.js';

export const jobOrderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', JobOrderController.listJobOrders);
  fastify.get('/:id', JobOrderController.getJobOrder);
  fastify.post('/', { preHandler: [requireRole(['admin', 'executive'])] }, JobOrderController.createJobOrder);
  fastify.patch('/:id', { preHandler: [requireRole(['admin', 'executive'])] }, JobOrderController.updateJobOrder);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, JobOrderController.deleteJobOrder);

  fastify.post('/:id/leads', { preHandler: [requireRole(['admin', 'executive'])] }, JobOrderController.assignLeads);
  fastify.patch('/leads/:leadId/status', JobOrderController.updateLeadStatus);
};
