import { FastifyPluginAsync } from 'fastify';
import { InvoiceController } from './invoice.controller.js';

export const publicInvoiceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:token', InvoiceController.getPublicInvoice);
  fastify.get('/:token/pdf', InvoiceController.getPublicInvoicePDF);
};
