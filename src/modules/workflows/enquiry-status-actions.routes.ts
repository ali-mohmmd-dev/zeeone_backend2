import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createEnquiryStatusActionsService } from './enquiry-status-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const EnquiryStatusActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/updateEnquiryStatusWithActivity', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-status-actions', 'updateEnquiryStatusWithActivity');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryStatusActionsService(app.prisma, request.currentUser).updateEnquiryStatusWithActivity(body.input);
    });
    app.post('/updateEnquiryStatusDirectToEnrolled', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-status-actions', 'updateEnquiryStatusDirectToEnrolled');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryStatusActionsService(app.prisma, request.currentUser).updateEnquiryStatusDirectToEnrolled(body.input);
    });
};
