import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import { callLogFilterSchema, createCallLogSchema } from './call-log.schema.js';
import { CallLogService } from './call-log.service.js';

export class CallLogController {
  static async listCallLogs(request: FastifyRequest, reply: FastifyReply) {
    const filters = callLogFilterSchema.parse(request.query);
    const service = new CallLogService(request.server.prisma);
    const { callLogs, total } = await service.listCallLogs(filters, request.user);
    return reply.send(paginatedResponse(callLogs, total, filters.page, filters.limit));
  }

  static async createCallLog(request: FastifyRequest, reply: FastifyReply) {
    const validated = createCallLogSchema.parse(request.body);
    const service = new CallLogService(request.server.prisma);
    const created = await service.createCallLog(validated, request.user.id);
    return reply.status(201).send(successResponse(created, 'Call logged successfully'));
  }

  static async getCallStats(request: FastifyRequest, reply: FastifyReply) {
    const service = new CallLogService(request.server.prisma);
    const stats = await service.getCallStats(request.user);
    return reply.send(successResponse(stats));
  }
}