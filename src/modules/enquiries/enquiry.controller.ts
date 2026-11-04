import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import {
  changeEnquiryStatusSchema,
  createEnquirySchema,
  enquiryFilterSchema,
  updateEnquirySchema,
} from './enquiry.schema.js';
import { EnquiryService } from './enquiry.service.js';
import { ForbiddenError } from '../../errors/app-error.js';
import { assignEnquiries, assignmentSchema } from './enquiry-assignment.service.js';
import { z } from 'zod';
import { invalidateDashboardCache } from '../workflows/support/lib/cache/cache-invalidation.js';

export class EnquiryController {
  static async listEnquiries(request: FastifyRequest, reply: FastifyReply) {
    const filters = enquiryFilterSchema.parse(request.query);
    const service = new EnquiryService(request.server.prisma);
    const { enquiries, total } = await service.listEnquiries(filters, request.user);
    return reply.send(paginatedResponse(enquiries, total, filters.page, filters.limit));
  }

  static async getEnquiry(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new EnquiryService(request.server.prisma);
    const enquiry = await service.getEnquiryById(id);
    const role = (request.user.role || '').toLowerCase();
    const canViewAll = ['admin', 'manager', 'executive', 'branch manager'].includes(role);
    if (!canViewAll && enquiry.assignedToUserId !== request.user.id) {
      throw new ForbiddenError('Access denied');
    }

    return reply.send(successResponse({
      ...enquiry,
      enquirySource: enquiry.enquirySource || (enquiry.source ? { id: enquiry.source, name: enquiry.source } : null),
      requiredService: enquiry.service,
    }, 'Enquiry fetched successfully'));
  }

  static async createEnquiry(request: FastifyRequest, reply: FastifyReply) {
    request.log.info({ step: 'validation_started' }, 'Inquiry create step');
    const validated = createEnquirySchema.parse(request.body);
    request.log.info({ step: 'validation_succeeded', hasBranch: Boolean(validated.branchId), hasAssignee: Boolean(validated.assignedToUserId) }, 'Inquiry create step');
    const service = new EnquiryService(request.server.prisma);
    const created = await service.createEnquiry(validated, request.user, (step, fields = {}) => request.log.info({ step, ...fields }, 'Inquiry create step'));
    request.log.info({ step: 'completed', recordId: created.id }, 'Inquiry create step');
    return reply.status(201).send(successResponse(created, 'Enquiry created successfully'));
  }

  static async updateEnquiry(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = updateEnquirySchema.parse(request.body);
    const service = new EnquiryService(request.server.prisma);
    const updated = await service.updateEnquiry(id, validated, request.user);
    return reply.send(successResponse(updated, 'Enquiry updated successfully'));
  }

  static async deleteEnquiry(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new EnquiryService(request.server.prisma);
    await service.deleteEnquiry(id, request.user);
    return reply.send(successResponse(null, 'Enquiry deleted successfully'));
  }

  static async changeStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = changeEnquiryStatusSchema.parse(request.body);
    const service = new EnquiryService(request.server.prisma);
    const updated = await service.changeStatus(id, validated, request.user.id);
    return reply.send(successResponse(updated, 'Status updated successfully'));
  }

  static async assignEnquiry(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = assignmentSchema.parse(request.body);
    const result = await assignEnquiries(request.server.prisma, request.currentUser, [id], input);
    await invalidateDashboardCache();
    return reply.send(successResponse(result, 'Enquiry assigned and job order created successfully'));
  }

  static async bulkAssign(request: FastifyRequest, reply: FastifyReply) {
    const input = assignmentSchema.extend({ enquiryIds: z.array(z.string().min(1)).min(1).max(5000) }).parse(request.body);
    const result = await assignEnquiries(request.server.prisma, request.currentUser, input.enquiryIds, input);
    await invalidateDashboardCache();
    return reply.send(successResponse(result, `${result.count} enquiries assigned successfully`));
  }

  static async listActivities(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new EnquiryService(request.server.prisma);
    const activities = await service.listActivities(id);
    return reply.send(successResponse(activities));
  }
}
