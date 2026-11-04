import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from '../config/env.js';

const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  const serverHost = config.host === '0.0.0.0' ? 'localhost' : config.host;

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'CRM Elevate API Documentation',
        description: 'Standalone Fastify + PostgreSQL REST API backend for CRM Elevate',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${serverHost}:${config.port}`,
          description: 'Development Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'auth_token',
          },
        },
      },
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    },
  });

  try {
    await fastify.register(swaggerUi, {
      routePrefix: '/api/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  } catch (err) {
    fastify.log.warn(err, 'Swagger UI registration skipped');
  }
};

export default fp(swaggerPlugin);
