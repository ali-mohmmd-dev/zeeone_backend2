import { buildApp } from './app.js';
import { config } from './config/env.js';
import type { FastifyInstance } from 'fastify';

async function start() {
  let app: FastifyInstance | undefined;
  try {
    app = await buildApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    app.log.info({ url: 'http://' + config.host + ':' + config.port, documentation: '/api/docs' }, 'Server ready');

    const signals = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        app!.log.info({ signal }, 'Shutting down gracefully');
        await app!.close();
        process.exit(0);
      });
    }
  } catch (err) {
    if (app) app.log.fatal({ err }, 'Fatal error starting server');
    else console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

start();
