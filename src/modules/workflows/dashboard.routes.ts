import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createDashboardService } from './dashboard.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const DashboardRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getDashboardData', async (request) => {
        requireWorkflowAccess(request.currentUser, 'dashboard', 'getDashboardData');
        z.object({ userId: z.string().min(1).optional(), userRole: z.string().min(1).optional(), userBranch: z.string().min(1).optional() }).parse(request.body || {});
        return createDashboardService(app.prisma, request.currentUser).getDashboardData(request.currentUser.id, request.currentUser.role || undefined, request.currentUser.branch || undefined);
    });
};
