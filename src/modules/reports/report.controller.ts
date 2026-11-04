import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../utils/response.js';
import { ReportService } from './report.service.js';

export class ReportController {
  static async getTelecallerPerformance(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = (request.query as { startDate?: string; endDate?: string }) || {};
    const service = new ReportService(request.server.prisma);
    const data = await service.getTelecallerPerformance(startDate, endDate);
    return reply.send(successResponse(data));
  }

  static async getBranchAnalytics(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = (request.query as { startDate?: string; endDate?: string }) || {};
    const service = new ReportService(request.server.prisma);
    const data = await service.getBranchAnalytics(startDate, endDate);
    return reply.send(successResponse(data));
  }

  static async getPaymentReport(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = (request.query as { startDate?: string; endDate?: string }) || {};
    const service = new ReportService(request.server.prisma);
    const data = await service.getPaymentReport(startDate, endDate);
    return reply.send(successResponse(data));
  }

  static async getExpenseReport(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = (request.query as { startDate?: string; endDate?: string }) || {};
    const service = new ReportService(request.server.prisma);
    const data = await service.getExpenseReport(startDate, endDate);
    return reply.send(successResponse(data));
  }

  static async getInvoiceReport(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = (request.query as { startDate?: string; endDate?: string }) || {};
    const service = new ReportService(request.server.prisma);
    const data = await service.getInvoiceReport(startDate, endDate);
    return reply.send(successResponse(data));
  }
}