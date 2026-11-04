import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { PrismaClient } from '@prisma/client';
import { workflowRoutes } from './workflow.routes.js';
import { uiRoutes } from './ui.routes.js';
import { userRoutes } from '../users/user.routes.js';
import { errorHandler } from '../../middleware/error.middleware.js';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function fixture(role = 'admin', banned = false) {
  const app = Fastify();
  const calls: any[] = [];
  const user = { id: 'user-1', name: 'Test User', email: 'test@example.com', role, branch: 'branch-1', banned, password: 'private-hash', userRole: null };
  app.decorate('prisma', {
    user: { findUnique: async () => user, findMany: async () => [user] },
    branch: { findMany: async () => [{ id: 'branch-1', name: 'Main branch' }] },
    admission: { findMany: async (query: any) => { calls.push(query); return []; }, count: async () => 0 },
    notification: { updateMany: async (query: any) => { calls.push(query); return { count: 1 }; } },
    expense: { create: async (query: any) => { calls.push(query); return { id: 'expense-1', ...query.data }; } },
  } as unknown as PrismaClient);
  await app.register(cookie);
  await app.register(jwt, { secret: 'test-secret-for-migration', cookie: { cookieName: 'auth_token', signed: false } });
  app.setErrorHandler(errorHandler);
  await app.register(workflowRoutes, { prefix: '/api/v1/workflows' });
  await app.register(uiRoutes, { prefix: '/api/v1/ui' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.ready();
  const token = app.jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, branch: user.branch });
  return { app, calls, headers: { authorization: `Bearer ${token}` } };
}

test('migrated endpoints require a verified token, including server page data', async t => {
  const { app } = await fixture();
  t.after(() => app.close());
  for (const [method, url] of [
    ['POST', '/api/v1/workflows/admission-actions/getAdmissions'],
    ['POST', '/api/v1/workflows/auth/getAllUsers'],
    ['POST', '/api/v1/workflows/service-actions/listServiceBilling'],
    ['POST', '/api/v1/workflows/proposal-proposal-actions/getProposals'],
    ['GET', '/api/v1/ui/sidebar-counts'],
  ] as const) {
    for (const headers of [{}, { authorization: 'Bearer forged-token' }, { cookie: 'user=%7B%22id%22%3A%22user-1%22%7D' }]) {
      const response = await app.inject({ method, url, headers, ...(method === 'POST' ? { payload: {} } : {}) });
      assert.equal(response.statusCode, 401, url);
    }
  }
});

test('banned users cannot call migrated endpoints', async t => {
  const { app, headers } = await fixture('admin', true);
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/workflows/auth/getAllUsers', headers, payload: {} });
  assert.equal(response.statusCode, 401);
});

test('user administration and master-data mutations remain protected on the backend', async t => {
  const { app, headers } = await fixture('telecaller');
  t.after(() => app.close());
  for (const url of ['/api/v1/workflows/auth/createUserAction', '/api/v1/workflows/data-management/deleteBranch']) {
    const response = await app.inject({ method: 'POST', url, headers, payload: { input: {} } });
    assert.equal(response.statusCode, 403);
  }
});

test('report roles are checked by Fastify even when the user has the reports feature', async t => {
  const { app, headers } = await fixture('accounts');
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/workflows/report-actions/getTelecallerPerformanceReport', headers, payload: { input: {} } });
  assert.equal(response.statusCode, 403);
});

test('API responses exclude stored passwords even in relation data', async t => {
  const { app, headers } = await fixture();
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/workflows/auth/getAllUsers', headers, payload: {} });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json()[0].name, 'Test User');
  assert.equal(response.json()[0].password, undefined);
  assert.equal(response.body.includes('private-hash'), false);
});

test('lookup actions accept the no-argument UI call and validate mutation input', async t => {
  const { app, headers } = await fixture();
  t.after(() => app.close());
  const branches = await app.inject({ method: 'POST', url: '/api/v1/workflows/enquiry-action/getBranches', headers, payload: {} });
  assert.equal(branches.statusCode, 200);
  assert.equal(branches.json().data[0].id, 'branch-1');
  const invalid = await app.inject({ method: 'POST', url: '/api/v1/workflows/admission-actions/createAdmission', headers, payload: { input: { candidateName: 'Incomplete' } } });
  assert.equal(invalid.statusCode, 400);
});

test('notifications are scoped to the authenticated user', async t => {
  const { app, headers, calls } = await fixture('telecaller');
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/workflows/notification/markAllAsRead', headers, payload: { userId: 'another-user' } });
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].where.userId, 'user-1');
});

test('the self-service password route exists and rejects incomplete input', async t => {
  const { app, headers } = await fixture('telecaller');
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/users/change-password', headers, payload: {} });
  assert.equal(response.statusCode, 400);
});

test('expense dates sent as JSON are validated and converted before database writes', async t => {
  const { app, headers, calls } = await fixture();
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/workflows/expense-actions/createExpenseAction', headers,
    payload: { input: { title: 'Travel', amount: 100, category: 'TRAVEL', expenseDate: '2026-10-30T00:00:00.000Z' } } });
  assert.equal(response.statusCode, 200, response.body);
  assert.ok(calls[0].data.expenseDate instanceof Date);
});

test('every migrated frontend action calls an endpoint registered in Fastify', async t => {
  const { app } = await fixture();
  t.after(() => app.close());
  const sourceRoot = fileURLToPath(new URL('../../../../crm.elevate.com/src/', import.meta.url));
  function files(folder: string): string[] {
    return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(folder, entry.name)) : [path.join(folder, entry.name)]);
  }
  const endpoints = new Set<string>();
  for (const file of [...files(path.join(sourceRoot, 'server/actions')), ...files(path.join(sourceRoot, 'lib/actions'))]) {
    for (const match of readFileSync(file, 'utf8').matchAll(/['"](\/workflows\/[^'"]+)['"]/g)) endpoints.add(match[1]);
  }
  assert.ok(endpoints.size > 100);
  for (const endpoint of endpoints) assert.equal(app.hasRoute({ method: 'POST', url: '/api/v1' + endpoint }), true, endpoint);
});
