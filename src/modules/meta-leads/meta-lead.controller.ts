import type { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../utils/response.js';
import type { MetaLeadService } from './meta-lead.service.js';

export class MetaLeadController {
  constructor(private service: MetaLeadService) {}

  verify = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    reply.header('Cache-Control', 'no-store');
    reply.type('text/plain').send(this.service.verify(request.query));
  };

  receive = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    reply.send(await this.service.receive(request.body));
  };

  process = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    reply.header('Cache-Control', 'no-store');
    reply.send(successResponse(await this.service.process()));
  };
}
