import * as schemas from './workflow.schema.js';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createDataManagementService } from './data-management.service.js';
import { requireWorkflowAccess } from './workflow-access.js';
export const DataManagementRoutes: FastifyPluginAsync = async (app) => {
    app.post('/getAllRoles', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'getAllRoles');
        z.object({}).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).getAllRoles();
    });
    app.post('/createRole', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'createRole');
        const body = z.object({ input: schemas.roleInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).createRole(body.input);
    });
    app.post('/updateRole', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'updateRole');
        const body = z.object({ input: schemas.roleInput.extend(schemas.idInput.shape) }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).updateRole(body.input);
    });
    app.post('/deleteRole', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'deleteRole');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).deleteRole(body.input);
    });
    app.post('/getAllCourses', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'getAllCourses');
        z.object({}).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).getAllCourses();
    });
    app.post('/createCourse', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'createCourse');
        const body = z.object({ input: schemas.courseInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).createCourse(body.input);
    });
    app.post('/updateCourse', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'updateCourse');
        const body = z.object({ input: schemas.courseInput.extend(schemas.idInput.shape) }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).updateCourse(body.input);
    });
    app.post('/deleteCourse', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'deleteCourse');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).deleteCourse(body.input);
    });
    app.post('/toggleCourseStatus', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'toggleCourseStatus');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).toggleCourseStatus(body.input);
    });
    app.post('/getAllBranches', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'getAllBranches');
        z.object({}).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).getAllBranches();
    });
    app.post('/createBranch', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'createBranch');
        const body = z.object({ input: schemas.branchInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).createBranch(body.input);
    });
    app.post('/updateBranch', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'updateBranch');
        const body = z.object({ input: schemas.branchInput.extend(schemas.idInput.shape) }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).updateBranch(body.input);
    });
    app.post('/deleteBranch', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'deleteBranch');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).deleteBranch(body.input);
    });
    app.post('/toggleBranchStatus', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'toggleBranchStatus');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).toggleBranchStatus(body.input);
    });
    app.post('/getAllEnquirySources', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'getAllEnquirySources');
        z.object({}).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).getAllEnquirySources();
    });
    app.post('/createEnquirySource', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'createEnquirySource');
        const body = z.object({ input: schemas.sourceInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).createEnquirySource(body.input);
    });
    app.post('/updateEnquirySource', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'updateEnquirySource');
        const body = z.object({ input: schemas.sourceInput.extend(schemas.idInput.shape) }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).updateEnquirySource(body.input);
    });
    app.post('/deleteEnquirySource', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'deleteEnquirySource');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).deleteEnquirySource(body.input);
    });
    app.post('/toggleEnquirySourceStatus', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'toggleEnquirySourceStatus');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).toggleEnquirySourceStatus(body.input);
    });
    app.post('/getAllRequiredServices', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'getAllRequiredServices');
        z.object({}).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).getAllRequiredServices();
    });
    app.post('/getAllServices', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'getAllServices');
        z.object({}).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).getAllServices();
    });
    app.post('/createService', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'createService');
        const body = z.object({ input: schemas.serviceInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).createService(body.input);
    });
    app.post('/updateService', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'updateService');
        const body = z.object({ input: schemas.serviceInput.extend(schemas.idInput.shape) }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).updateService(body.input);
    });
    app.post('/deleteService', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'deleteService');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).deleteService(body.input);
    });
    app.post('/createRequiredService', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'createRequiredService');
        const body = z.object({ input: schemas.sourceInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).createRequiredService(body.input);
    });
    app.post('/updateRequiredService', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'updateRequiredService');
        const body = z.object({ input: schemas.sourceInput.extend(schemas.idInput.shape) }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).updateRequiredService(body.input);
    });
    app.post('/deleteRequiredService', async (request) => {
        requireWorkflowAccess(request.currentUser, 'data-management', 'deleteRequiredService');
        const body = z.object({ input: schemas.idInput }).parse(request.body || {});
        return createDataManagementService(app.prisma, request.currentUser).deleteRequiredService(body.input);
    });
};
