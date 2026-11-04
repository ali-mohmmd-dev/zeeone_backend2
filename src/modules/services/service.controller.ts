import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../utils/response.js';
import { serviceItemSchema } from './service.schema.js';
import { ServicesService } from './service.service.js';

export class ServiceController {
  static async listServices(request: FastifyRequest, reply: FastifyReply) {
    const { activeOnly } = (request.query as { activeOnly?: string }) || {};
    const service = new ServicesService(request.server.prisma);
    const data = await service.listServices(activeOnly === 'true');
    return reply.send(successResponse(data));
  }

  static async createService(request: FastifyRequest, reply: FastifyReply) {
    const validated = serviceItemSchema.parse(request.body);
    const service = new ServicesService(request.server.prisma);
    const created = await service.createService(validated);
    return reply.status(201).send(successResponse(created, 'Service created successfully'));
  }

  static async updateService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = serviceItemSchema.partial().parse(request.body);
    const service = new ServicesService(request.server.prisma);
    const updated = await service.updateService(id, validated);
    return reply.send(successResponse(updated, 'Service updated successfully'));
  }

  static async deleteService(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new ServicesService(request.server.prisma);
    await service.deleteService(id);
    return reply.send(successResponse(null, 'Service deleted successfully'));
  }
}