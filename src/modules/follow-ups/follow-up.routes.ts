import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { FollowUpController } from './follow-up.controller.js';

export const followUpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', FollowUpController.listFollowUps);
  fastify.get('/:id', FollowUpController.getFollowUp);
  fastify.post('/', FollowUpController.createFollowUp);
  fastify.patch('/:id', FollowUpController.updateFollowUp);
  fastify.post('/:id/reschedule', FollowUpController.rescheduleFollowUp);
  fastify.delete('/:id', FollowUpController.deleteFollowUp);
};
