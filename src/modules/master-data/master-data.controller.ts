import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../utils/response.js';
import { branchSchema, courseSchema } from './master-data.schema.js';
import { MasterDataService } from './master-data.service.js';

export class MasterDataController {
  // Branches
  static async listBranches(request: FastifyRequest, reply: FastifyReply) {
    const { activeOnly } = (request.query as { activeOnly?: string }) || {};
    const service = new MasterDataService(request.server.prisma);
    const data = await service.listBranches(activeOnly === 'true');
    return reply.send(successResponse(data));
  }

  static async createBranch(request: FastifyRequest, reply: FastifyReply) {
    const validated = branchSchema.parse(request.body);
    const service = new MasterDataService(request.server.prisma);
    const created = await service.createBranch(validated);
    return reply.status(201).send(successResponse(created, 'Branch created'));
  }

  static async updateBranch(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = branchSchema.partial().parse(request.body);
    const service = new MasterDataService(request.server.prisma);
    const updated = await service.updateBranch(id, validated);
    return reply.send(successResponse(updated, 'Branch updated'));
  }

  static async deleteBranch(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new MasterDataService(request.server.prisma);
    await service.deleteBranch(id);
    return reply.send(successResponse(null, 'Branch deleted'));
  }

  // Courses
  static async listCourses(request: FastifyRequest, reply: FastifyReply) {
    const { activeOnly } = (request.query as { activeOnly?: string }) || {};
    const service = new MasterDataService(request.server.prisma);
    const data = await service.listCourses(activeOnly === 'true');
    return reply.send(successResponse(data));
  }

  static async createCourse(request: FastifyRequest, reply: FastifyReply) {
    const validated = courseSchema.parse(request.body);
    const service = new MasterDataService(request.server.prisma);
    const created = await service.createCourse(validated);
    return reply.status(201).send(successResponse(created, 'Course created'));
  }

  static async updateCourse(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = courseSchema.partial().parse(request.body);
    const service = new MasterDataService(request.server.prisma);
    const updated = await service.updateCourse(id, validated);
    return reply.send(successResponse(updated, 'Course updated'));
  }

  static async deleteCourse(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new MasterDataService(request.server.prisma);
    await service.deleteCourse(id);
    return reply.send(successResponse(null, 'Course deleted'));
  }

  // Enquiry Sources (Static list)
  static async listEnquirySources(request: FastifyRequest, reply: FastifyReply) {
    const service = new MasterDataService(request.server.prisma);
    const data = await service.listEnquirySources();
    return reply.send(successResponse(data));
  }

  // Required Services (From Service model)
  static async listRequiredServices(request: FastifyRequest, reply: FastifyReply) {
    const { activeOnly } = (request.query as { activeOnly?: string }) || {};
    const service = new MasterDataService(request.server.prisma);
    const data = await service.listRequiredServices(activeOnly === 'true');
    return reply.send(successResponse(data));
  }

  // Roles
  static async listRoles(request: FastifyRequest, reply: FastifyReply) {
    const service = new MasterDataService(request.server.prisma);
    const data = await service.listRoles();
    return reply.send(successResponse(data));
  }
}