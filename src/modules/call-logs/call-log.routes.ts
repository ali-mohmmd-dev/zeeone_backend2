import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { CallLogController } from './call-log.controller.js';

export const callLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', CallLogController.listCallLogs);
  fastify.post('/', CallLogController.createCallLog);
  fastify.get('/stats', CallLogController.getCallStats);
};
