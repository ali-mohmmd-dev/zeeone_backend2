import type { IncomingMessage, ServerResponse } from 'http';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

let appInstance: FastifyInstance | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    appInstance = await buildApp();
    await appInstance.ready();
  }
  return appInstance;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    await app.ready();
    app.server.emit('request', req, res);
  } catch (error) {
    console.error('Fastify Serverless Handler Error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
