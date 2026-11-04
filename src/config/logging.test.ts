import assert from 'node:assert/strict';
import test from 'node:test';
import fastify, { LogController } from 'fastify';
import pino from 'pino';
import pretty from 'pino-pretty';
import { z } from 'zod';
import { configureRequestLogging, getLoggerOptions, normalizeNodeEnv, parseLogLevel } from './logging.js';
import { errorHandler } from '../middleware/error.middleware.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

test('development formatting handles unset environment and the existing spelling; production and Vercel use JSON', () => {
  const terminal = { isTTY: true, noColor: false, term: 'xterm' };
  for (const nodeEnv of [undefined, 'development', 'developement', ' Development ']) {
    const options = getLoggerOptions({ nodeEnv }, terminal);
    assert.equal(options.level, 'info');
    assert.equal((options.transport as { target: string }).target, 'pino-pretty');
  }
  for (const environment of [{ nodeEnv: 'production' }, { nodeEnv: 'development', vercel: '1' }, { nodeEnv: 'production', vercel: '1' }]) {
    assert.deepEqual(getLoggerOptions(environment, terminal), { level: 'info' });
  }
  assert.equal(normalizeNodeEnv('developement'), 'development');
  assert.equal(parseLogLevel(' DEBUG '), 'debug');
  assert.equal(parseLogLevel(undefined), 'info');
  assert.throws(() => parseLogLevel('verbose'), /Invalid LOG_LEVEL/);
});

test('one completion block per request includes errors at the proper level without logging credentials or query values', async t => {
  const records: Array<Record<string, any>> = [];
  const logger = pino({ level: 'info' }, { write: (line: string) => { records.push(JSON.parse(line)); } });
  const app = fastify({ loggerInstance: logger, logController: new LogController({ disableRequestLogging: true }) });
  configureRequestLogging(app);
  app.setErrorHandler(errorHandler);
  t.after(() => app.close());
  app.post('/ok', async () => ({ success: true }));
  app.get('/unauthorized', async () => { throw new UnauthorizedError('Sign in required'); });
  app.get('/forbidden', async () => { throw new ForbiddenError('Access denied'); });
  app.get('/failure', async () => { throw new Error('Unexpected example failure'); });
  app.get('/conflict', async () => { throw Object.assign(new Error('Database detail'), { code: 'P2002' }); });
  app.post('/validation', async () => z.object({ count: z.number() }).parse({ count: 'invalid' }));
  app.post('/schema', { schema: { body: { type: 'object', required: ['count'], properties: { count: { type: 'number' } } } } }, async () => ({}));

  const success = await app.inject({ method: 'POST', url: '/ok?token=private-query', headers: { authorization: 'Bearer private-token', cookie: 'token=private-cookie' }, payload: { password: 'private-password' } });
  assert.equal(success.statusCode, 200);
  const cases = [
    ['GET', '/unauthorized', 401, 'UNAUTHORIZED'],
    ['GET', '/forbidden', 403, 'FORBIDDEN'],
    ['GET', '/failure', 500, 'INTERNAL_SERVER_ERROR'],
    ['GET', '/conflict', 409, 'CONFLICT'],
    ['POST', '/validation', 400, 'VALIDATION_ERROR'],
    ['POST', '/schema', 400, 'VALIDATION_ERROR'],
  ] as const;
  for (const [method, url, status, code] of cases) {
    const response = await app.inject({ method, url, ...(method === 'POST' ? { payload: {} } : {}) });
    assert.equal(response.statusCode, status);
    assert.equal(response.json().error.code, code);
  }
  assert.equal(records.length, 7);
  for (const record of records) {
    assert.equal(record.msg, 'Request completed');
    assert.match(record.reqId, /^req-/);
    assert.equal(typeof record.durationMs, 'number');
    assert.ok(record.durationMs >= 0);
    assert.equal(record.level, record.statusCode >= 500 ? 50 : record.statusCode >= 400 ? 40 : 30);
    if (record.statusCode >= 400 && record.statusCode < 500) assert.equal(record.err, undefined);
  }
  assert.equal(records[0].path, '/ok');
  assert.equal(records[2].message, 'Access denied');
  assert.match(records[3].err.stack, /Error: Unexpected example failure/);
  assert.doesNotMatch(JSON.stringify(records), /private-query|private-token|private-cookie|private-password/);

  const options = getLoggerOptions({ nodeEnv: 'development' }, { isTTY: false, noColor: false, term: undefined });
  const prettyOptions = (options.transport as { options: pretty.PrettyOptions }).options;
  const format = pretty.prettyFactory(prettyOptions);
  const output = format(records[2]);
  assert.match(output, /WARN/);
  assert.match(output, /Request completed/);
  assert.match(output, /\n\s+method: "GET"/);
  assert.match(output, /Access denied/);
  assert.doesNotMatch(output, /\u001b\[|hostname:|pid:/);
  assert.match(format(records[3]), /Error: Unexpected example failure/);
});

test('color options respect terminal support and LOG_LEVEL controls filtering', async t => {
  for (const terminal of [{ isTTY: false, noColor: false, term: undefined }, { isTTY: true, noColor: true, term: 'xterm' }, { isTTY: true, noColor: false, term: 'dumb' }]) {
    const options = getLoggerOptions({ nodeEnv: 'development' }, terminal);
    assert.equal((options.transport as { options: pretty.PrettyOptions }).options.colorize, false);
  }
  const colored = getLoggerOptions({ nodeEnv: 'development' }, { isTTY: true, noColor: false, term: 'xterm' });
  assert.equal((colored.transport as { options: pretty.PrettyOptions }).options.colorize, true);
  const records: Array<Record<string, unknown>> = [];
  const options = getLoggerOptions({ nodeEnv: 'production', logLevel: 'warn' });
  const app = fastify({ loggerInstance: pino(options, { write: (line: string) => { records.push(JSON.parse(line)); } }), logController: new LogController({ disableRequestLogging: true }) });
  configureRequestLogging(app);
  app.setErrorHandler(errorHandler);
  app.get('/ok', async () => ({}));
  app.get('/forbidden', async () => { throw new ForbiddenError('Access denied'); });
  t.after(() => app.close());
  await app.inject('/ok');
  await app.inject('/forbidden');
  assert.equal(records.length, 1);
  assert.equal(records[0].level, 40);
  assert.equal(records[0].statusCode, 403);
});
