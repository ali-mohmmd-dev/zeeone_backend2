import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import { notificationFilterSchema } from './notification.schema.js';
import { NotificationService } from './notification.service.js';

export class NotificationController {
  static async listNotifications(request: FastifyRequest, reply: FastifyReply) {
    const filters = notificationFilterSchema.parse(request.query);
    const service = new NotificationService(request.server.prisma);
    const { notifications, total, unreadCount } = await service.listNotifications(request.user.id, filters);

    const res = paginatedResponse(notifications, total, filters.page, filters.limit);
    (res as any).unreadCount = unreadCount;
    return reply.send(res);
  }

  static async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new NotificationService(request.server.prisma);
    const updated = await service.markAsRead(id, request.user.id);
    return reply.send(successResponse(updated, 'Marked as read'));
  }

  static async markAllAsRead(request: FastifyRequest, reply: FastifyReply) {
    const service = new NotificationService(request.server.prisma);
    await service.markAllAsRead(request.user.id);
    return reply.send(successResponse(null, 'All notifications marked as read'));
  }
}