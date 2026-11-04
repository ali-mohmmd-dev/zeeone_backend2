import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createFeeCollectionActionsService } from './fee-collection-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const FeeCollectionActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/createReceipt', async (request) => {
        requireWorkflowAccess(request.currentUser, 'fee-collection-actions', 'createReceipt');
        const body = z.object({ data: schemas.createReceiptInput }).parse(request.body || {});
        return createFeeCollectionActionsService(app.prisma, request.currentUser).createReceipt(body.data);
    });
    app.post('/updateReceipt', async (request) => {
        requireWorkflowAccess(request.currentUser, 'fee-collection-actions', 'updateReceipt');
        const body = z.object({ data: schemas.updateReceiptInput }).parse(request.body || {});
        return createFeeCollectionActionsService(app.prisma, request.currentUser).updateReceipt(body.data);
    });
    app.post('/deleteReceipt', async (request) => {
        requireWorkflowAccess(request.currentUser, 'fee-collection-actions', 'deleteReceipt');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createFeeCollectionActionsService(app.prisma, request.currentUser).deleteReceipt(body.id);
    });
    app.post('/getReceiptsByAdmissionId', async (request) => {
        requireWorkflowAccess(request.currentUser, 'fee-collection-actions', 'getReceiptsByAdmissionId');
        const body = z.object({ admissionId: z.string().min(1) }).parse(request.body || {});
        return createFeeCollectionActionsService(app.prisma, request.currentUser).getReceiptsByAdmissionId(body.admissionId);
    });
    app.post('/getAdmissionWithFeeDetails', async (request) => {
        requireWorkflowAccess(request.currentUser, 'fee-collection-actions', 'getAdmissionWithFeeDetails');
        const body = z.object({ admissionId: z.string().min(1) }).parse(request.body || {});
        return createFeeCollectionActionsService(app.prisma, request.currentUser).getAdmissionWithFeeDetails(body.admissionId);
    });
};
