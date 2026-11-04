import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createReceiptActionsService } from './receipt-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const ReceiptActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getReceiptById', async (request) => {
        requireWorkflowAccess(request.currentUser, 'receipt-actions', 'getReceiptById');
        const body = z.object({ id: z.string().min(1) }).parse(request.body || {});
        return createReceiptActionsService(app.prisma, request.currentUser).getReceiptById(body.id);
    });
    app.post('/getReceiptWithAdmissionData', async (request) => {
        requireWorkflowAccess(request.currentUser, 'receipt-actions', 'getReceiptWithAdmissionData');
        const body = z.object({ receiptId: z.string().min(1) }).parse(request.body || {});
        return createReceiptActionsService(app.prisma, request.currentUser).getReceiptWithAdmissionData(body.receiptId);
    });
};
