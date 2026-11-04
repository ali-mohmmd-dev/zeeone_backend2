import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import {
  assignJobLeadsSchema,
  createJobOrderSchema,
  jobOrderFilterSchema,
  updateJobLeadStatusSchema,
} from './job-order.schema.js';
import { JobOrderService } from './job-order.service.js';

export class JobOrderController {
  static async listJobOrders(request: FastifyRequest, reply: FastifyReply) {
    const filters = jobOrderFilterSchema.parse(request.query);
    const service = new JobOrderService(request.server.prisma);
    const { jobOrders, total } = await service.listJobOrders(filters);
    return reply.send(paginatedResponse(jobOrders, total, filters.page, filters.limit));
  }

  static async getJobOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new JobOrderService(request.server.prisma);
    const jobOrder = await service.getJobOrderById(id);
    return reply.send(successResponse(jobOrder));
  }

  static async createJobOrder(request: FastifyRequest, reply: FastifyReply) {
    const validated = createJobOrderSchema.parse(request.body);
    const service = new JobOrderService(request.server.prisma);
    const created = await service.createJobOrder(validated, request.user.id);
    return reply.status(201).send(successResponse(created, 'Job order created successfully'));
  }

  static async updateJobOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = createJobOrderSchema.partial().parse(request.body);
    const service = new JobOrderService(request.server.prisma);
    const updated = await service.updateJobOrder(id, validated);
    return reply.send(successResponse(updated, 'Job order updated successfully'));
  }

  static async deleteJobOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new JobOrderService(request.server.prisma);
    await service.deleteJobOrder(id);
    return reply.send(successResponse(null, 'Job order deleted successfully'));
  }

  static async assignLeads(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = assignJobLeadsSchema.parse(request.body);
    const service = new JobOrderService(request.server.prisma);
    const result = await service.assignLeads(id, validated, request.user.id);
    return reply.send(successResponse(result, `${result.count} leads attached to job order`));
  }

  static async updateLeadStatus(request: FastifyRequest, reply: FastifyReply) {
    const { leadId } = request.params as { leadId: string };
    const validated = updateJobLeadStatusSchema.parse(request.body);
    const service = new JobOrderService(request.server.prisma);
    const updated = await service.updateLeadStatus(leadId, validated);
    return reply.send(successResponse(updated, 'Lead status updated'));
  }
}