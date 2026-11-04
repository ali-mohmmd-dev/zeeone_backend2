import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../utils/response.js';
import { DashboardService } from './dashboard.service.js';

export class DashboardController {
  static async getStats(request: FastifyRequest, reply: FastifyReply) {
    const service = new DashboardService(request.server.prisma);
    const stats = await service.getDashboardStats(request.user);
    return reply.send(successResponse(stats));
  }

  static async getActivities(request: FastifyRequest, reply: FastifyReply) {
    const { limit } = (request.query as { limit?: string }) || {};
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const service = new DashboardService(request.server.prisma);
    const activities = await service.getRecentActivities(request.user, parsedLimit);
    return reply.send(successResponse(activities));
  }
}