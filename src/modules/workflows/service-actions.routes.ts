import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createServiceActionsService } from './service-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const ServiceActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/listServiceBilling', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'listServiceBilling');
        const body = z.object({ page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).max(100).optional(), searchQuery: z.string().optional(), sortBy: z.string().optional(), sortOrder: z.enum(['asc', 'desc']).optional(), serviceId: z.string().optional(), courseId: z.string().optional() }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).listServiceBilling(body.page, body.pageSize, body.searchQuery, body.sortBy, body.sortOrder, body.serviceId, body.courseId);
    });
    app.post('/createServiceBilling', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'createServiceBilling');
        const body = z.object({ input: schemas.createServiceBillingInput }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).createServiceBilling(body.input);
    });
    app.post('/updateServiceBilling', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'updateServiceBilling');
        const body = z.object({ input: schemas.updateServiceBillingInput }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).updateServiceBilling(body.input);
    });
    app.post('/getServiceBillHistory', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'getServiceBillHistory');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).getServiceBillHistory(body.id);
    });
    app.post('/payServiceBilling', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'payServiceBilling');
        const body = z.object({ input: schemas.payServiceBillingInput }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).payServiceBilling(body.input);
    });
    app.post('/getServiceBillByStudentId', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'getServiceBillByStudentId');
        const body = z.object({ studentId: z.string().min(1) }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).getServiceBillByStudentId(body.studentId);
    });
    app.post('/deleteServiceBilling', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'deleteServiceBilling');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).deleteServiceBilling(body.input);
    });
    app.post('/listStudents', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'listStudents');
        z.object({}).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).listStudents();
    });
    app.post('/listServices', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'listServices');
        z.object({}).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).listServices();
    });
    app.post('/totalListing', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'totalListing');
        z.object({}).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).totalListing();
    });
    app.post('/getServiceBillById', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'getServiceBillById');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).getServiceBillById(body.id);
    });
    app.post('/getServicesByIds', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'getServicesByIds');
        const body = z.object({ ids: z.array(z.string().min(1)) }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).getServicesByIds(body.ids);
    });
    app.post('/getAdmissionHistoryById', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'getAdmissionHistoryById');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).getAdmissionHistoryById(body.id);
    });
    app.post('/getServiceBillDetailsForPDF', async (request) => {
        requireWorkflowAccess(request.currentUser, 'service-actions', 'getServiceBillDetailsForPDF');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createServiceActionsService(app.prisma, request.currentUser).getServiceBillDetailsForPDF(body.id);
    });
};
