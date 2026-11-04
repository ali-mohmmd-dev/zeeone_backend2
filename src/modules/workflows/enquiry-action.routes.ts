import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createEnquiryActionService } from './enquiry-action.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const EnquiryActionRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getBranches', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-action', 'getBranches');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryActionService(app.prisma, request.currentUser).getBranches(body.input);
    });
    app.post('/getCourses', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-action', 'getCourses');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryActionService(app.prisma, request.currentUser).getCourses(body.input);
    });
    app.post('/getEnquirySources', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-action', 'getEnquirySources');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryActionService(app.prisma, request.currentUser).getEnquirySources(body.input);
    });
    app.post('/getRequiredServices', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-action', 'getRequiredServices');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryActionService(app.prisma, request.currentUser).getRequiredServices(body.input);
    });
    app.post('/getUsers', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry-action', 'getUsers');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createEnquiryActionService(app.prisma, request.currentUser).getUsers(body.input);
    });
};
