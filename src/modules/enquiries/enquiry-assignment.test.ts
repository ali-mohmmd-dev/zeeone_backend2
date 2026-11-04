import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { assignEnquiries, assignmentSchema } from './enquiry-assignment.service.js';

const user = { id: 'admin-1', role: 'admin', branch: 'branch-1' };
const input = assignmentSchema.parse({
  assignedToUserId: 'staff-1', branchId: 'branch-1', name: 'Site surveys',
  startDate: '2099-01-01', endDate: '2099-01-05',
});

function fixture(options: { missing?: boolean; banned?: boolean; assigneeBranch?: string; failNotification?: boolean } = {}) {
  const writes: Array<{ table: string; data: any }> = [];
  let transactions = 0;
  const tx = {
    branch: { findUnique: async () => ({ id: 'branch-1', isActive: true }) },
    user: { findUnique: async () => ({ id: 'staff-1', banned: options.banned || false, branch: options.assigneeBranch || 'branch-1' }) },
    enquiry: {
      findMany: async (query: any) => options.missing ? [] : query.where.id.in.map((id: string) => ({ id })),
      updateMany: async (query: any) => { writes.push({ table: 'enquiry', data: query }); return { count: query.where.id.in.length }; },
    },
    jobOrder: { create: async (query: any) => { writes.push({ table: 'jobOrder', data: query.data }); return { id: 'job-1' }; } },
    jobLead: { createMany: async (query: any) => { writes.push({ table: 'jobLead', data: query.data }); return { count: query.data.length }; } },
    notification: { create: async (query: any) => { if (options.failNotification) throw new Error('Notification failed'); writes.push({ table: 'notification', data: query.data }); return {}; } },
  };
  const prisma = { $transaction: async (run: (client: typeof tx) => Promise<unknown>) => { transactions++; return run(tx); } } as unknown as PrismaClient;
  return { prisma, writes, transactions: () => transactions };
}

test('bulk assignment creates one job, all leads and its notification inside the transaction', async () => {
  const db = fixture();
  const result = await assignEnquiries(db.prisma, user, ['lead-1', 'lead-2', 'lead-1'], input);
  assert.deepEqual(result, { count: 2, jobOrderId: 'job-1' });
  assert.equal(db.transactions(), 1);
  assert.deepEqual(db.writes.map(write => write.table), ['enquiry', 'jobOrder', 'jobLead', 'notification']);
  assert.equal(db.writes[1].data.assignerId, user.id);
  assert.equal(db.writes[1].data.managerId, input.assignedToUserId);
  assert.deepEqual(db.writes[2].data.map((lead: any) => lead.leadId), ['lead-1', 'lead-2']);
  assert.ok(db.writes[1].data.startDate instanceof Date);
});

test('single assignment creates a job with one lead', async () => {
  const db = fixture();
  assert.equal((await assignEnquiries(db.prisma, user, ['lead-1'], input)).count, 1);
  assert.equal(db.writes[2].data.length, 1);
});

test('unauthorized roles and branch changes fail before any transaction', async () => {
  for (const actor of [{ ...user, role: 'telecaller' }, { ...user, role: 'manager', branch: 'other-branch' }]) {
    const db = fixture();
    await assert.rejects(assignEnquiries(db.prisma, actor, ['lead-1'], input), /cannot assign|within your branch/);
    assert.equal(db.transactions(), 0);
  }
});

test('missing enquiries, suspended assignees and assignees in another branch cannot be assigned', async () => {
  for (const options of [{ missing: true }, { banned: true }, { assigneeBranch: 'other-branch' }]) {
    const db = fixture(options);
    await assert.rejects(assignEnquiries(db.prisma, user, ['lead-1'], input));
    assert.equal(db.writes.length, 0);
  }
});

test('bad dates and empty selections cannot reach the database', async () => {
  const db = fixture();
  await assert.rejects(assignEnquiries(db.prisma, user, [], input));
  await assert.rejects(assignEnquiries(db.prisma, user, ['lead-1'], { ...input, startDate: new Date('2100-01-01') }), /Start date/);
  await assert.rejects(assignEnquiries(db.prisma, user, ['lead-1'], { ...input, startDate: new Date('2000-01-01') }), /past/);
  assert.equal(db.transactions(), 0);
});

test('a notification failure rejects the transaction instead of succeeding with a partial assignment', async () => {
  const db = fixture({ failNotification: true });
  await assert.rejects(assignEnquiries(db.prisma, user, ['lead-1'], input), /Notification failed/);
});
