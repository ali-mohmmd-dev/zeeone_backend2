import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createReportsService } from './reports.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const ReportsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getReportsData', async (request) => {
        requireWorkflowAccess(request.currentUser, 'reports', 'getReportsData');
        z.object({ userId: z.string().min(1).optional() }).parse(request.body || {});
        return createReportsService(app.prisma, request.currentUser).getReportsData(request.currentUser.role === 'admin' ? undefined : request.currentUser.id);
    });
};
