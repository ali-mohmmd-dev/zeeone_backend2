import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createAdmissionActionsService } from './admission-actions.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const AdmissionActionsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getCurrentUser', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'getCurrentUser');
        z.object({}).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).getCurrentUser();
    });
    app.post('/createAdmission', async (request) => {
        request.log.info({ step: 'access_check_started' }, 'Site survey create step');
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'createAdmission');
        request.log.info({ step: 'access_check_succeeded' }, 'Site survey create step');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        request.log.info({ step: 'service_started' }, 'Site survey create step');
        const result = await createAdmissionActionsService(app.prisma, request.currentUser).createAdmission(body.input, (step, fields = {}) => request.log.info({ step, ...fields }, 'Site survey create step'));
        request.log.info({ step: 'completed' }, 'Site survey create step');
        return result;
    });
    app.post('/updateInstallationProgress', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'updateInstallationProgress');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).updateInstallationProgress(body.input);
    });
    app.post('/updateAdmission', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'updateAdmission');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).updateAdmission(body.input);
    });
    app.post('/deleteAdmission', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'deleteAdmission');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).deleteAdmission(body.input);
    });
    app.post('/getAdmissions', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'getAdmissions');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).getAdmissions(body.input);
    });
    app.post('/getAdmissionById', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'getAdmissionById');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).getAdmissionById(body.input);
    });
    app.post('/getAdmissionsByEnquiry', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'getAdmissionsByEnquiry');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).getAdmissionsByEnquiry(body.input);
    });
    app.post('/getSurveyAssignees', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'getSurveyAssignees');
        z.object({}).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).getSurveyAssignees();
    });
    app.post('/reassignAdmission', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'reassignAdmission');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).reassignAdmission(body.input);
    });
    app.post('/getEnquirySourcesForAdmission', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'getEnquirySourcesForAdmission');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).getEnquirySourcesForAdmission(body.input);
    });
    app.post('/getCoursesForAdmission', async (request) => {
        requireWorkflowAccess(request.currentUser, 'admission-actions', 'getCoursesForAdmission');
        const body = z.object({ input: z.unknown().optional() }).parse(request.body || {});
        return createAdmissionActionsService(app.prisma, request.currentUser).getCoursesForAdmission(body.input);
    });
};
