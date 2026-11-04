import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createInvoiceActionsService } from './invoice-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const InvoiceActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/createInvoice', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'createInvoice');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).createInvoice(body.input);
    });
    app.post('/updateInvoice', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'updateInvoice');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).updateInvoice(body.input);
    });
    app.post('/deleteInvoice', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'deleteInvoice');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).deleteInvoice(body.input);
    });
    app.post('/getInvoices', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'getInvoices');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).getInvoices(body.input);
    });
    app.post('/getInvoiceById', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'getInvoiceById');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).getInvoiceById(body.input);
    });
    app.post('/addInvoiceItem', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'addInvoiceItem');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).addInvoiceItem(body.input);
    });
    app.post('/updateInvoiceItem', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'updateInvoiceItem');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).updateInvoiceItem(body.input);
    });
    app.post('/deleteInvoiceItem', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'deleteInvoiceItem');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).deleteInvoiceItem(body.input);
    });
    app.post('/calculateInvoiceTotals', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-actions', 'calculateInvoiceTotals');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createInvoiceActionsService(app.prisma, request.currentUser).calculateInvoiceTotals(body.input);
    });
};
