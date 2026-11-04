import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { config } from '../config/env.js';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyCookie, {
    secret: config.cookieSecret,
    parseOptions: {},
  });

  await fastify.register(fastifyJwt, {
    secret: config.jwtSecret,
    cookie: {
      cookieName: 'auth_token',
      signed: false,
    },
  });
};

export default fp(authPlugin);
