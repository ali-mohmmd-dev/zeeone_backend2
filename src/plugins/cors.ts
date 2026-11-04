import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../config/env.js';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const allowedOrigins = [
    config.frontendUrl,
    config.backendUrl,
  ].filter(Boolean);

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (!origin || config.nodeEnv === 'development') {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
};

export default fp(corsPlugin);
