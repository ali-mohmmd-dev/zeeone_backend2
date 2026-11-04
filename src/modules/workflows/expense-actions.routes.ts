import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createExpenseActionsService } from './expense-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const ExpenseActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/createExpenseAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'createExpenseAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).createExpenseAction(body.input);
    });
    app.post('/updateExpenseAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'updateExpenseAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).updateExpenseAction(body.input);
    });
    app.post('/deleteExpenseAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'deleteExpenseAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).deleteExpenseAction(body.input);
    });
    app.post('/getExpensesAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'getExpensesAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).getExpensesAction(body.input);
    });
    app.post('/getExpenseByIdAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'getExpenseByIdAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).getExpenseByIdAction(body.input);
    });
    app.post('/getExpensesByUserAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'getExpensesByUserAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).getExpensesByUserAction(body.input);
    });
    app.post('/getExpensesByDateRangeAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'getExpensesByDateRangeAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).getExpensesByDateRangeAction(body.input);
    });
    app.post('/getExpensesByCategoryAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'getExpensesByCategoryAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).getExpensesByCategoryAction(body.input);
    });
    app.post('/duplicateExpenseAction', async (request) => {
        requireWorkflowAccess(request.currentUser, 'expense-actions', 'duplicateExpenseAction');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createExpenseActionsService(app.prisma, request.currentUser).duplicateExpenseAction(body.input);
    });
};
