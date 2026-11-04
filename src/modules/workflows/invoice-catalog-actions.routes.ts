import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createInvoiceCatalogActionsService } from './invoice-catalog-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const InvoiceCatalogActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getInvoiceProductCatalog', async (request) => {
        requireWorkflowAccess(request.currentUser, 'invoice-catalog-actions', 'getInvoiceProductCatalog');
        const body = z.object({ customerQuery: schemas.customerQueryInput.optional() }).parse(request.body || {});
        return createInvoiceCatalogActionsService(app.prisma, request.currentUser).getInvoiceProductCatalog(body.customerQuery);
    });
};
