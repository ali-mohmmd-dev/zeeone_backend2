import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import { createReceiptSchema, receiptFilterSchema } from './receipt.schema.js';
import { ReceiptService } from './receipt.service.js';

export class ReceiptController {
  static async listReceipts(request: FastifyRequest, reply: FastifyReply) {
    const filters = receiptFilterSchema.parse(request.query);
    const service = new ReceiptService(request.server.prisma);
    const { receipts, total } = await service.listReceipts(filters);
    return reply.send(paginatedResponse(receipts, total, filters.page, filters.limit));
  }

  static async getReceipt(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new ReceiptService(request.server.prisma);
    const receipt = await service.getReceiptById(id);
    return reply.send(successResponse(receipt));
  }

  static async createReceipt(request: FastifyRequest, reply: FastifyReply) {
    const validated = createReceiptSchema.parse(request.body);
    const service = new ReceiptService(request.server.prisma);
    const created = await service.createReceipt(validated, request.user.id);
    return reply.status(201).send(successResponse(created, 'Receipt generated successfully'));
  }

  static async deleteReceipt(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new ReceiptService(request.server.prisma);
    await service.deleteReceipt(id);
    return reply.send(successResponse(null, 'Receipt deleted successfully'));
  }

  static async generatePDF(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { download } = (request.query as { download?: string }) || {};
    const service = new ReceiptService(request.server.prisma);
    const pdfBuffer = await service.generatePDF(id);

    reply.header('Content-Type', 'application/pdf');
    if (download === 'true') {
      reply.header('Content-Disposition', `attachment; filename="Receipt-${id}.pdf"`);
    } else {
      reply.header('Content-Disposition', `inline; filename="Receipt-${id}.pdf"`);
    }

    return reply.send(Buffer.from(pdfBuffer));
  }
}