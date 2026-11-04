import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError } from '../../errors/app-error.js';
import { NotificationFilterInput } from './notification.schema.js';

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async listNotifications(userId: string, filters: NotificationFilterInput) {
    const { unreadOnly, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly === 'true') where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount };
  }

  async markAsRead(id: string, userId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notif) throw new NotFoundError('Notification');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
