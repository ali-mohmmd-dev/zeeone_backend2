import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole, requireFeature } from '../../middleware/permission.middleware.js';
import { InvoiceController } from './invoice.controller.js';

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireFeature('invoices'));

  fastify.get('/payment-settings', InvoiceController.getPaymentSettings);
  fastify.put('/payment-settings', InvoiceController.updatePaymentSettings);
  fastify.get('/payment-settings/next-number', InvoiceController.getNextPaymentNumber);
  fastify.post('/:id/items', InvoiceController.addItem);
  fastify.patch('/items/:itemId', InvoiceController.updateItem);
  fastify.delete('/items/:itemId', InvoiceController.deleteItem);
  fastify.post('/:id/payments', InvoiceController.createPayment);
  fastify.delete('/:id/payments/:paymentId', { preHandler: [requireRole(['admin'])] }, InvoiceController.deletePayment);
  fastify.post('/:id/send', InvoiceController.sendInvoice);
  fastify.post('/:id/share', InvoiceController.createShareLink);
  fastify.delete('/:id/share', InvoiceController.revokeShareLink);
  fastify.put('/:id/reminders', InvoiceController.updateReminders);
  fastify.post('/:id/reminders/send', InvoiceController.sendReminder);
  fastify.get('/', InvoiceController.listInvoices);
  fastify.get('/:id', InvoiceController.getInvoice);
  fastify.get('/:id/pdf', InvoiceController.generatePDF);
  fastify.post('/', InvoiceController.createInvoice);
  fastify.patch('/:id', InvoiceController.updateInvoice);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, InvoiceController.deleteInvoice);
};
