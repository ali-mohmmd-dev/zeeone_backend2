import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createNotificationService } from './notification.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const NotificationRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getNotifications', async (request) => {
        requireWorkflowAccess(request.currentUser, 'notification', 'getNotifications');
        z.object({}).parse(request.body || {});
        return createNotificationService(app.prisma, request.currentUser).getNotifications();
    });
    app.post('/markAsRead', async (request) => {
        requireWorkflowAccess(request.currentUser, 'notification', 'markAsRead');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createNotificationService(app.prisma, request.currentUser).markAsRead(body.id);
    });
    app.post('/markAllAsRead', async (request) => {
        requireWorkflowAccess(request.currentUser, 'notification', 'markAllAsRead');
        z.object({}).parse(request.body || {});
        return createNotificationService(app.prisma, request.currentUser).markAllAsRead();
    });
};
