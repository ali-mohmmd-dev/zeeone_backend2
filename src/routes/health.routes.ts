import { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    return {
      name: 'CRM Elevate API',
      status: 'running',
      documentation: '/api/docs',
      health: '/health',
      version: '1.0.0',
      revision: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    };
  });

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/health/ready', async (request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'connected', timestamp: new Date().toISOString() };
    } catch (err) {
      request.log.error(err, 'Database readiness check failed');
      return reply.status(503).send({ status: 'unhealthy', database: 'disconnected' });
    }
  });
};
