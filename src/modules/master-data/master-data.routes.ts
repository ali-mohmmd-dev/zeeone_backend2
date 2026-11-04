import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/permission.middleware.js';
import { MasterDataController } from './master-data.controller.js';

export const masterDataRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // Branches
  fastify.get('/branches', MasterDataController.listBranches);
  fastify.post('/branches', { preHandler: [requireRole(['admin'])] }, MasterDataController.createBranch);
  fastify.patch('/branches/:id', { preHandler: [requireRole(['admin'])] }, MasterDataController.updateBranch);
  fastify.delete('/branches/:id', { preHandler: [requireRole(['admin'])] }, MasterDataController.deleteBranch);

  // Courses
  fastify.get('/courses', MasterDataController.listCourses);
  fastify.post('/courses', { preHandler: [requireRole(['admin'])] }, MasterDataController.createCourse);
  fastify.patch('/courses/:id', { preHandler: [requireRole(['admin'])] }, MasterDataController.updateCourse);
  fastify.delete('/courses/:id', { preHandler: [requireRole(['admin'])] }, MasterDataController.deleteCourse);

  // Enquiry Sources
  fastify.get('/enquiry-sources', MasterDataController.listEnquirySources);

  // Required Services
  fastify.get('/required-services', MasterDataController.listRequiredServices);

  // Roles
  fastify.get('/roles', MasterDataController.listRoles);
};
