import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { ReportController } from './report.controller.js';

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireRole(['admin', 'executive']));

  fastify.get('/telecaller', ReportController.getTelecallerPerformance);
  fastify.get('/branch', ReportController.getBranchAnalytics);
  fastify.get('/payments', ReportController.getPaymentReport);
  fastify.get('/expenses', ReportController.getExpenseReport);
  fastify.get('/invoices', ReportController.getInvoiceReport);
};
