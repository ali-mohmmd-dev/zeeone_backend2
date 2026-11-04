import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createJobOrderService } from './job-order.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const JobOrderRoutes: FastifyPluginAsync = async (app) => {
    app.post('/createJobOrder', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'createJobOrder');
        const body = z.object({ input: schemas.createJobOrderInput }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).createJobOrder(body.input);
    });
    app.post('/getJobOrders', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'getJobOrders');
        const body = z.object({ filters: schemas.jobOrderFilters.optional() }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).getJobOrders(body.filters);
    });
    app.post('/getJobOrder', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'getJobOrder');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).getJobOrder(body.id);
    });
    app.post('/updateJobLeadStatus', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'updateJobLeadStatus');
        const body = z.object({ jobLeadId: z.string().min(1), status: z.enum(['PENDING', 'CLOSED']) }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).updateJobLeadStatus(body.jobLeadId, body.status);
    });
    app.post('/getJobOrderStats', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'getJobOrderStats');
        const body = z.object({ jobId: z.string().min(1) }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).getJobOrderStats(body.jobId);
    });
    app.post('/deleteJobOrder', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'deleteJobOrder');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).deleteJobOrder(body.id);
    });
    app.post('/reassignJobOrder', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'reassignJobOrder');
        const body = z.object({ id: z.string().min(1), newManagerId: z.string().min(1) }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).reassignJobOrder(body.id, body.newManagerId);
    });
    app.post('/getJobLead', async (request) => {
        requireWorkflowAccess(request.currentUser, 'job-order', 'getJobLead');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createJobOrderService(app.prisma, request.currentUser).getJobLead(body.id);
    });
};
