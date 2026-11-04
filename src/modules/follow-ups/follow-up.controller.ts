import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import {
  createFollowUpSchema,
  followUpFilterSchema,
  rescheduleFollowUpSchema,
  updateFollowUpSchema,
} from './follow-up.schema.js';
import { FollowUpService } from './follow-up.service.js';

export class FollowUpController {
  static async listFollowUps(request: FastifyRequest, reply: FastifyReply) {
    const filters = followUpFilterSchema.parse(request.query);
    const service = new FollowUpService(request.server.prisma);
    const { followUps, total } = await service.listFollowUps(filters, request.user);
    return reply.send(paginatedResponse(followUps, total, filters.page, filters.limit));
  }

  static async getFollowUp(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new FollowUpService(request.server.prisma);
    const followUp = await service.getFollowUpById(id);
    return reply.send(successResponse(followUp));
  }

  static async createFollowUp(request: FastifyRequest, reply: FastifyReply) {
    const validated = createFollowUpSchema.parse(request.body);
    const service = new FollowUpService(request.server.prisma);
    const created = await service.createFollowUp(validated, request.user.id);
    return reply.status(201).send(successResponse(created, 'Follow-up scheduled successfully'));
  }

  static async updateFollowUp(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = updateFollowUpSchema.parse(request.body);
    const service = new FollowUpService(request.server.prisma);
    const updated = await service.updateFollowUp(id, validated, request.user.id);
    return reply.send(successResponse(updated, 'Follow-up updated successfully'));
  }

  static async rescheduleFollowUp(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = rescheduleFollowUpSchema.parse(request.body);
    const service = new FollowUpService(request.server.prisma);
    const updated = await service.rescheduleFollowUp(id, validated, request.user.id);
    return reply.send(successResponse(updated, 'Follow-up rescheduled successfully'));
  }

  static async deleteFollowUp(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new FollowUpService(request.server.prisma);
    await service.deleteFollowUp(id);
    return reply.send(successResponse(null, 'Follow-up deleted successfully'));
  }
}