import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { ReceiptController } from './receipt.controller.js';

export const receiptRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', ReceiptController.listReceipts);
  fastify.get('/:id', ReceiptController.getReceipt);
  fastify.get('/:id/pdf', ReceiptController.generatePDF);
  fastify.post('/', { preHandler: [requireRole(['admin', 'executive'])] }, ReceiptController.createReceipt);
  fastify.delete('/:id', { preHandler: [requireRole(['admin'])] }, ReceiptController.deleteReceipt);
};
