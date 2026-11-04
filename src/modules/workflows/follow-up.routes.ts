import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createFollowUpService } from './follow-up.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const FollowUpRoutes: FastifyPluginAsync = async (app) => {
    app.post('/createFollowUp', async (request) => {
        requireWorkflowAccess(request.currentUser, 'follow-up', 'createFollowUp');
        const body = z.object({ data: schemas.createFollowUpInput }).parse(request.body || {});
        return createFollowUpService(app.prisma, request.currentUser).createFollowUp(body.data);
    });
    app.post('/getFollowUps', async (request) => {
        requireWorkflowAccess(request.currentUser, 'follow-up', 'getFollowUps');
        const body = z.object({ filters: schemas.followUpFilters.optional() }).parse(request.body || {});
        return createFollowUpService(app.prisma, request.currentUser).getFollowUps(body.filters);
    });
    app.post('/updateFollowUp', async (request) => {
        requireWorkflowAccess(request.currentUser, 'follow-up', 'updateFollowUp');
        const body = z.object({ data: schemas.updateFollowUpInput }).parse(request.body || {});
        return createFollowUpService(app.prisma, request.currentUser).updateFollowUp(body.data);
    });
    app.post('/deleteFollowUp', async (request) => {
        requireWorkflowAccess(request.currentUser, 'follow-up', 'deleteFollowUp');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createFollowUpService(app.prisma, request.currentUser).deleteFollowUp(body.id);
    });
};
