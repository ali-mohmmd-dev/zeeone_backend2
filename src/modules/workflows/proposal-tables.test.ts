import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { createProposalProposalActionsService } from './proposal-proposal-actions.service.js';
import { ProposalProposalActionsRoutes } from './proposal-proposal-actions.routes.js';
import { errorHandler } from '../../middleware/error.middleware.js';

const user = { id: 'admin-1', name: 'Admin', role: 'admin', branch: null, userRole: null } as WorkflowUser;
const input = { clientName: 'Test customer', items: [{ description: 'Panel', quantity: 1, unitPrice: 100 }] };

test('missing proposal tables return HTTP 503 instead of HTTP 200', async t => {
  let writes = 0;
  const prisma = {
    proposal: {
      count: async () => { throw Object.assign(new Error('Missing table'), { code: 'P2021' }); },
      create: async () => { writes++; },
    },
  } as unknown as PrismaClient;
  const app = Fastify();
  t.after(() => app.close());
  app.decorate('prisma', prisma);
  app.addHook('preHandler', async request => { request.currentUser = user; });
  app.setErrorHandler(errorHandler);
  await app.register(ProposalProposalActionsRoutes);
  const response = await app.inject({ method: 'POST', url: '/createProposal', payload: { input } });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'DATABASE_SCHEMA_MISSING');
  assert.equal(writes, 0);
});

test('proposal creation still uses the existing proposal number format', async () => {
  let record: Record<string, unknown> = {};
  const prisma = {
    proposal: {
      count: async () => 2,
      create: async ({ data }: { data: Record<string, unknown> }) => { record = data; return { ...data, id: 'proposal-1' }; },
    },
  } as unknown as PrismaClient;
  const result = await createProposalProposalActionsService(prisma, user).createProposal(input);
  assert.equal(result.success, true);
  assert.equal(record.proposalNo, `PROP-${new Date().getFullYear()}-0003`);
});

test('the repair only creates proposal tables and matches the current money column types', () => {
  const sql = readFileSync(new URL('../../../prisma/repairs/20261031_create_proposal_tables.sql', import.meta.url), 'utf8');
  assert.deepEqual([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(match => match[1]).sort(), ['proposal', 'proposal_item']);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE|UPDATE)\s/im);
  assert.match(sql, /"subtotal" DECIMAL\(19,4\)/);
  assert.match(sql, /"taxRate" DECIMAL\(9,6\)/);
  assert.match(sql, /CONSTRAINT "proposal_pkey" PRIMARY KEY \("id"\)\s*\);/);
  assert.match(sql, /CONSTRAINT "proposal_item_pkey" PRIMARY KEY \("id"\)\s*\);/);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
});
