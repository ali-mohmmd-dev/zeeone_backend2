import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createEnquiryActivityActionsService } from './enquiry-activity-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const EnquiryActivityActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getEnquiryActivities', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-activity-actions', 'getEnquiryActivities');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryActivityActionsService(app.prisma, request.currentUser).getEnquiryActivities(body.input);
    });
};
