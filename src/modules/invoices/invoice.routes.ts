import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { InvoiceController } from './invoice.controller.js';

export const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/payment-settings', InvoiceController.getPaymentSettings);
  fastify.put('/payment-settings', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.updatePaymentSettings);
  fastify.get('/payment-settings/next-number', InvoiceController.getNextPaymentNumber);
  fastify.post('/:id/items', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.addItem);
  fastify.patch('/items/:itemId', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.updateItem);
  fastify.delete('/items/:itemId', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.deleteItem);
  fastify.post('/:id/payments', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.createPayment);
  fastify.delete('/:id/payments/:paymentId', { preHandler: [requireRole(['admin'])] }, InvoiceController.deletePayment);
  fastify.post('/:id/send', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.sendInvoice);
  fastify.post('/:id/share', InvoiceController.createShareLink);
  fastify.delete('/:id/share', InvoiceController.revokeShareLink);
  fastify.put('/:id/reminders', InvoiceController.updateReminders);
  fastify.post('/:id/reminders/send', InvoiceController.sendReminder);
  fastify.get('/', InvoiceController.listInvoices);
  fastify.get('/:id', InvoiceController.getInvoice);
  fastify.get('/:id/pdf', InvoiceController.generatePDF);
  fastify.post('/', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.createInvoice);
  fastify.patch('/:id', { preHandler: [requireRole(['admin', 'executive'])] }, InvoiceController.updateInvoice);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, InvoiceController.deleteInvoice);
};
