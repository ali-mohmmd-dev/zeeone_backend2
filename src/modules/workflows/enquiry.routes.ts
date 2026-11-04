import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createEnquiryService } from './enquiry.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const EnquiryRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getCurrentUser', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'getCurrentUser');
        z.object({}).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).getCurrentUser();
    });
    app.post('/getEnquiryFollowUps', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'getEnquiryFollowUps');
        const body = z.object({ enquiryId: z.string().min(1) }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).getEnquiryFollowUps(body.enquiryId);
    });
    app.post('/getEnquiryCallLogs', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'getEnquiryCallLogs');
        const body = z.object({ enquiryId: z.string().min(1) }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).getEnquiryCallLogs(body.enquiryId);
    });
    app.post('/getEnquiryJobLeads', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'getEnquiryJobLeads');
        const body = z.object({ enquiryId: z.string().min(1) }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).getEnquiryJobLeads(body.enquiryId);
    });
    app.post('/updateEnquiryStatus', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'updateEnquiryStatus');
        const body = z.object({ id: z.string().min(1), status: schemas.enquiryStatusInput }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).updateEnquiryStatus(body.id, body.status);
    });
    app.post('/updateEnquiryStatusWithActivity', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'updateEnquiryStatusWithActivity');
        const body = z.object({ id: z.string().min(1), newStatus: schemas.enquiryStatusInput, statusRemarks: z.string().optional() }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).updateEnquiryStatusWithActivity(body.id, body.newStatus, body.statusRemarks);
    });
    app.post('/updateEnquiryStatusDirectToEnrolled', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'updateEnquiryStatusDirectToEnrolled');
        const body = z.object({ id: z.string().min(1), statusRemarks: z.string().min(1).optional() }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).updateEnquiryStatusDirectToEnrolled(body.id, body.statusRemarks);
    });
    app.post('/bulkImportEnquiries', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'bulkImportEnquiries');
        const body = z.object({ leads: schemas.importLeadsInput, commonFields: schemas.importCommonFields }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).bulkImportEnquiries(body.leads, body.commonFields);
    });
    app.post('/getUsers', async (request) => {
        requireWorkflowAccess(request.currentUser, 'enquiry', 'getUsers');
        const body = z.object({ branchId: z.string().min(1).optional() }).parse(request.body || {});
        return createEnquiryService(app.prisma, request.currentUser).getUsers(body.branchId);
    });
};
