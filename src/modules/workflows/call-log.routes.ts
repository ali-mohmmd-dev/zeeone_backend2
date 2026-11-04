import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createCallLogService } from './call-log.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const CallLogRoutes: FastifyPluginAsync = async (app) => {
    app.post('/createCallLog', async (request) => {
        requireWorkflowAccess(request.currentUser, 'call-log', 'createCallLog');
        const body = z.object({ data: schemas.createCallLogInput }).parse(request.body || {});
        return createCallLogService(app.prisma, request.currentUser).createCallLog(body.data);
    });
    app.post('/getCallLogs', async (request) => {
        requireWorkflowAccess(request.currentUser, 'call-log', 'getCallLogs');
        const body = z.object({ filters: schemas.callLogFilters.optional() }).parse(request.body || {});
        return createCallLogService(app.prisma, request.currentUser).getCallLogs(body.filters);
    });
    app.post('/deleteCallLog', async (request) => {
        requireWorkflowAccess(request.currentUser, 'call-log', 'deleteCallLog');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createCallLogService(app.prisma, request.currentUser).deleteCallLog(body.id);
    });
};
