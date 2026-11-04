import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createReportActionsService } from './report-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const ReportActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getTelecallerPerformanceReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getTelecallerPerformanceReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getTelecallerPerformanceReport(body.input);
    });
    app.post('/getTelecallerEnquiryStats', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getTelecallerEnquiryStats');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getTelecallerEnquiryStats(body.input);
    });
    app.post('/getTelecallerConversionRates', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getTelecallerConversionRates');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getTelecallerConversionRates(body.input);
    });
    app.post('/getBranchPerformanceReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getBranchPerformanceReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getBranchPerformanceReport(body.input);
    });
    app.post('/getBranchAdmissionStats', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getBranchAdmissionStats');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getBranchAdmissionStats(body.input);
    });
    app.post('/getAdmissionPaymentReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getAdmissionPaymentReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getAdmissionPaymentReport(body.input);
    });
    app.post('/getExpenseReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getExpenseReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getExpenseReport(body.input);
    });
    app.post('/getInvoiceReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getInvoiceReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getInvoiceReport(body.input);
    });
    app.post('/getIncomeReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getIncomeReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getIncomeReport(body.input);
    });
    app.post('/getPendingPaymentReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getPendingPaymentReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getPendingPaymentReport(body.input);
    });
    app.post('/exportTelecallerReportCSV', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'exportTelecallerReportCSV');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).exportTelecallerReportCSV(body.input);
    });
    app.post('/exportFinancialReportCSV', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'exportFinancialReportCSV');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).exportFinancialReportCSV(body.input);
    });
    app.post('/getReportDashboardData', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getReportDashboardData');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getReportDashboardData(body.input);
    });
    app.post('/getBranchReport', async (request) => {
        requireWorkflowAccess(request.currentUser, 'report-actions', 'getBranchReport');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createReportActionsService(app.prisma, request.currentUser).getBranchReport(body.input);
    });
};
