import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { AdmissionController } from './admission.controller.js';

export const admissionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', AdmissionController.listAdmissions);
  fastify.get('/:id', AdmissionController.getAdmission);
  fastify.post('/', { preHandler: [requireRole(['admin', 'executive'])] }, AdmissionController.createAdmission);
  fastify.patch('/:id', { preHandler: [requireRole(['admin', 'executive'])] }, AdmissionController.updateAdmission);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, AdmissionController.deleteAdmission);
};
