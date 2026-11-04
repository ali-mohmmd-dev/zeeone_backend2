import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { CustomerController } from './customer.controller.js';

export const customerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/invoice-options', CustomerController.listInvoiceCustomers);
  fastify.post('/', { preHandler: [requireRole(['admin', 'executive'])] }, CustomerController.createCustomer);
  fastify.post('/from-admission/:id', { preHandler: [requireRole(['admin', 'executive'])] }, CustomerController.createFromAdmission);
};
