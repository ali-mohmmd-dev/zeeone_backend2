import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { EnquiryController } from './enquiry.controller.js';

export const enquiryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', EnquiryController.listEnquiries);
  fastify.get('/:id', EnquiryController.getEnquiry);
  fastify.post('/', EnquiryController.createEnquiry);
  fastify.patch('/:id', EnquiryController.updateEnquiry);
  fastify.delete('/:id', EnquiryController.deleteEnquiry);

  fastify.post('/:id/status', EnquiryController.changeStatus);
  fastify.post('/:id/assign', { preHandler: [requireRole(['admin', 'manager', 'executive', 'branch manager'])] }, EnquiryController.assignEnquiry);
  fastify.post('/bulk-assign', { preHandler: [requireRole(['admin', 'manager', 'executive', 'branch manager'])] }, EnquiryController.bulkAssign);

  fastify.get('/:id/activities', EnquiryController.listActivities);
};
