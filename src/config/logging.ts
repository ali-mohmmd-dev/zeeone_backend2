import type { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';
import type { LoggerOptions } from 'pino';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export function normalizeNodeEnv(value?: string): string {
  const environment = value?.trim().toLowerCase() || 'development';
  // Preserve compatibility with the spelling used by existing local .env files.
  return environment === 'developement' ? 'development' : environment;
}

export function parseLogLevel(value?: string): typeof LOG_LEVELS[number] {
  const level = value?.trim().toLowerCase() || 'info';
  if (!LOG_LEVELS.includes(level as typeof LOG_LEVELS[number])) {
    throw new Error('Invalid LOG_LEVEL. Use fatal, error, warn, info, debug, trace, or silent.');
  }
  return level as typeof LOG_LEVELS[number];
}

export function getLoggerOptions(environment: { nodeEnv?: string; vercel?: string; logLevel?: string }, terminal = {
  isTTY: Boolean(process.stdout.isTTY),
  noColor: process.env.NO_COLOR !== undefined,
  term: process.env.TERM,
}): LoggerOptions {
  const level = parseLogLevel(environment.logLevel);
  if (normalizeNodeEnv(environment.nodeEnv) !== 'development' || environment.vercel) return { level };
  return {
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: false,
        colorize: terminal.isTTY && !terminal.noColor && terminal.term !== 'dumb',
      },
    },
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    completionError: { code: string; message: string; err?: Error } | null;
  }
}

export function configureRequestLogging<Logger extends FastifyBaseLogger>(app: FastifyInstance<RawServerDefault, RawRequestDefaultExpression<RawServerDefault>, RawReplyDefaultExpression<RawServerDefault>, Logger>): void {
  app.decorateRequest('completionError', null);
  app.addHook('onResponse', async (request, reply) => {
    const fields = {
      method: request.method,
      path: request.url.split('?')[0],
      statusCode: reply.statusCode,
      durationMs: Number(reply.elapsedTime.toFixed(2)),
      ...request.completionError,
    };
    const level = reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info';
    request.log[level](fields, 'Request completed');
  });
}
