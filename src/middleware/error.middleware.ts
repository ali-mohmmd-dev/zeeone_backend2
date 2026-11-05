import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';
import { errorResponse } from '../utils/response.js';

export function errorHandler(error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) {
  const record = (code: string, message: string, statusCode: number) => {
    request.completionError = { code, message, ...(statusCode >= 500 ? { err: error } : {}) };
  };

  if (error instanceof AppError) {
    record(error.code, error.message, error.statusCode);
    return reply.status(error.statusCode).send(errorResponse(error.code, error.message, error.details));
  }

  if (error instanceof ZodError) {
    record('VALIDATION_ERROR', 'Input validation failed', 400);
    const formatted = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return reply.status(400).send(errorResponse('VALIDATION_ERROR', 'Input validation failed', formatted));
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    record('VALIDATION_ERROR', error.message, 400);
    return reply.status(400).send(errorResponse('VALIDATION_ERROR', error.message, error.validation));
  }

  // Prisma unique constraint error
  if ('code' in error && error.code === 'P2002') {
    record('CONFLICT', 'A record with this unique value already exists', 409);
    return reply.status(409).send(errorResponse('CONFLICT', 'A record with this unique value already exists'));
  }

  // Prisma foreign key constraint error
  if ('code' in error && error.code === 'P2003') {
    const meta = (error as { meta?: { field_name?: string } }).meta;
    const field = meta?.field_name || 'referenced record';
    const msg = `Operation failed: linked record does not exist or has active dependencies (${field})`;
    record('BAD_REQUEST', msg, 400);
    return reply.status(400).send(errorResponse('BAD_REQUEST', msg));
  }

  // Prisma record not found error
  if ('code' in error && error.code === 'P2025') {
    const meta = (error as { meta?: { cause?: string } }).meta;
    const msg = meta?.cause || 'Record not found';
    record('NOT_FOUND', msg, 404);
    return reply.status(404).send(errorResponse('NOT_FOUND', msg));
  }

  // Default server error
  const statusCode = ('statusCode' in error && typeof error.statusCode === 'number') ? error.statusCode : 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message;

  record('INTERNAL_SERVER_ERROR', error.message, statusCode);
  return reply.status(statusCode).send(errorResponse('INTERNAL_SERVER_ERROR', message));
}
