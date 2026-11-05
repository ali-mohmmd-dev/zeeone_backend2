import type { FastifyPluginAsync } from 'fastify';
import { config } from '../../config/env.js';
import { MetaLeadController } from './meta-lead.controller.js';
import { MetaLeadRepository } from './meta-lead.repository.js';
import { MetaLeadService } from './meta-lead.service.js';
import { requireSecret, verifySignature } from './meta-lead.security.js';
import type { MetaSettings } from './meta-lead.schema.js';

declare module 'fastify' {
  interface FastifyRequest { metaRawBody: Buffer | null }
}

type Options = { settings?: MetaSettings; service?: MetaLeadService };
export const metaLeadRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  const settings = options.settings ?? config.meta;
  const service = options.service ?? new MetaLeadService(new MetaLeadRepository(app.prisma), settings);
  const controller = new MetaLeadController(service);
  app.decorateRequest('metaRawBody', null);
  // Override JSON parsing only inside this plugin; HMAC must use the exact wire bytes.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 1_048_576 }, (request, body, done) => {
    const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
    request.metaRawBody = rawBody;
    const parser = app.getDefaultJsonParser('error', 'error');
    parser(request, rawBody.toString('utf8'), done);
  });
  app.get('/webhook', {
    schema: {
      querystring: { type: 'object', additionalProperties: true },
      response: { 200: { type: 'string' } },
    },
  }, controller.verify);
  app.post('/webhook', {
    bodyLimit: 1_048_576,
    preValidation: async request => {
      const signature = request.headers['x-hub-signature-256'];
      verifySignature(request.metaRawBody ?? Buffer.alloc(0), typeof signature === 'string' ? signature : undefined, settings.appSecret);
    },
    schema: {
      body: { type: 'object', additionalProperties: true },
      response: { 200: { type: 'object', required: ['received'], properties: { received: { type: 'boolean' } } } },
    },
  }, controller.receive);
  app.get('/process', {
    schema: {
      response: {
        200: {
          type: 'object', required: ['success', 'data'],
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', required: ['imported', 'deferred'], properties: { imported: { type: 'integer' }, deferred: { type: 'integer' } } },
          },
        },
      },
    },
    preHandler: async request => requireSecret(request.headers.authorization, settings.processSecret ? `Bearer ${settings.processSecret}` : ''),
  }, controller.process);
};
