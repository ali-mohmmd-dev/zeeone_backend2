import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { createUserLifecycleService } from './user-lifecycle.service.js';
import { AuthService } from '../auth/auth.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const actor = { id: 'admin', name: 'Admin', role: 'admin' };
function fixture() {
  const user = { id: 'former', name: 'Former Employee', email: 'former@example.com', role: 'telecaller', branch: 'b1', isActive: true, authVersion: 0 };
  const replacement = { id: 'new', name: 'Replacement', role: 'admin', branch: 'b1', isActive: true, banned: false };
  const writes: { model: string; query: any }[] = [];
  const rows: Record<string, any[]> = {
    jobOrder: [{ id: 'job1', name: 'Open job', branchId: 'b1' }],
    jobLead: [{ id: 'lead1', job: { name: 'Open job', branchId: 'b1' } }],
    enquiry: [{ id: 'enquiry1', candidateName: 'Customer', branchId: 'b1' }],
    admission: [{ id: 'survey1', assignedToUserId: user.id, handledByUserId: null, enquiry: { branchId: 'b1' } }],
    followUp: [{ id: 'follow1', enquiryId: 'enquiry1' }],
  };
  let linked = { createdCallLogs: 1, accounts: 1, sessions: 1 };
  const db: any = {
    user: {
      findUnique: async ({ select }: any) => select?._count ? { _count: linked } : user,
      findFirst: async () => replacement,
      findMany: async () => [replacement],
      update: async (query: any) => { writes.push({ model: 'user', query }); user.isActive = query.data.isActive; if (query.data.authVersion) user.authVersion++; },
      delete: async (query: any) => writes.push({ model: 'deleteUser', query }),
    },
    session: { deleteMany: async (query: any) => writes.push({ model: 'sessions', query }) },
    notification: { create: async (query: any) => writes.push({ model: 'notification', query }) },
    userLifecycleEvent: {
      findMany: async () => [],
      create: async (query: any) => { writes.push({ model: 'audit', query }); },
    },
  };
  for (const model of Object.keys(rows)) db[model] = {
    findMany: async () => rows[model],
    updateMany: async (query: any) => { writes.push({ model, query }); return { count: query.where.id.in.length }; },
  };
  db.$transaction = async (run: any) => run(db);
  return { db: db as PrismaClient, user, replacement, rows, writes, empty: () => { for (const key of Object.keys(rows)) rows[key] = []; linked = { createdCallLogs: 0, accounts: 1, sessions: 1 }; } };
}

test('deactivation transfers pending assignments, preserves authorship and records an audit snapshot', async () => {
  const f = fixture();
  const service = createUserLifecycleService(f.db, actor);
  const preview = await service.preview({ userId: f.user.id });
  await service.deactivate({ userId: f.user.id, replacementId: 'new', revision: preview.revision });
  assert.equal(f.user.isActive, false);
  assert.equal(f.user.authVersion, 1);
  assert.equal(f.writes.find(w => w.model === 'sessions')?.query.where.userId, f.user.id);
  for (const write of f.writes.filter(w => ['jobOrder', 'jobLead', 'enquiry', 'admission'].includes(w.model))) {
    assert.equal(JSON.stringify(write.query.data).includes('createdBy'), false);
    assert.equal(JSON.stringify(write.query.data).includes('assigner'), false);
    assert.equal(Object.values(write.query.data).every(value => value === 'new'), true);
  }
  assert.equal(f.writes.some(w => w.model === 'followUp' || w.model === 'deleteUser'), false);
  const audit = f.writes.find(w => w.model === 'audit')!.query.data;
  assert.equal(audit.actorId, 'admin');
  assert.equal(audit.userName, 'Former Employee');
  assert.equal(audit.replacementName, 'Replacement');
  assert.equal(audit.transfers.jobs[0].id, 'job1');
  assert.equal(audit.transfers.followUps[0].id, 'follow1');
});

test('stale confirmation, absent replacement and inactive replacement cannot change anything', async () => {
  const f = fixture();
  const service = createUserLifecycleService(f.db, actor);
  const preview = await service.preview({ userId: f.user.id });
  await assert.rejects(service.deactivate({ userId: f.user.id, replacementId: 'new', revision: 'outdated' }), /Pending work changed/);
  await assert.rejects(service.deactivate({ userId: f.user.id, revision: preview.revision }), /Select another active user/);
  (f.db.user as any).findFirst = async () => null;
  await assert.rejects(service.deactivate({ userId: f.user.id, replacementId: 'new', revision: preview.revision }), /Select another active user/);
  assert.equal(f.writes.length, 0);
});

test('branch and access permissions are enforced before transfer', async () => {
  const f = fixture();
  const service = createUserLifecycleService(f.db, actor);
  const preview = await service.preview({ userId: f.user.id });
  f.replacement.role = 'telecaller';
  await assert.rejects(service.deactivate({ userId: f.user.id, replacementId: 'new', revision: preview.revision }), /permission/);
  f.rows.admission = [];
  f.replacement.branch = 'other';
  const updated = await service.preview({ userId: f.user.id });
  await assert.rejects(service.deactivate({ userId: f.user.id, replacementId: 'new', revision: updated.revision }), /branch/);
  assert.equal(f.writes.length, 0);
});

test('unused users can deactivate without transfer and reactivate without reclaiming assignments', async () => {
  const f = fixture(); f.empty();
  const service = createUserLifecycleService(f.db, actor);
  const preview = await service.preview({ userId: f.user.id });
  await service.deactivate({ userId: f.user.id, revision: preview.revision });
  f.writes.length = 0;
  await service.reactivate({ userId: f.user.id });
  assert.equal(f.user.isActive, true);
  assert.equal(f.user.authVersion, 1);
  assert.deepEqual(f.writes.map(w => w.model), ['user', 'audit']);
});

test('self-deactivation, administrator accounts and non-administrators are protected', async () => {
  const f = fixture();
  await assert.rejects(createUserLifecycleService(f.db, actor).preview({ userId: 'admin' }), /own account/);
  await assert.rejects(createUserLifecycleService(f.db, { ...actor, role: 'manager' }).preview({ userId: f.user.id }), /Administrator access/);
  f.user.role = 'admin';
  await assert.rejects(createUserLifecycleService(f.db, actor).preview({ userId: f.user.id }), /Administrator accounts/);
  assert.equal(f.writes.length, 0);
});

test('permanent deletion rejects work history, but accepts an unused account', async () => {
  const f = fixture();
  const service = createUserLifecycleService(f.db, actor);
  await assert.rejects(service.permanentlyDelete({ userId: f.user.id }), /CRM records/);
  f.empty();
  (f.db.userLifecycleEvent as any).findMany = async () => [{ transfers: { jobs: [{ id: 'old-job' }] } }];
  await assert.rejects(service.permanentlyDelete({ userId: f.user.id }), /history/);
  (f.db.userLifecycleEvent as any).findMany = async () => [];
  await service.permanentlyDelete({ userId: f.user.id });
  assert.deepEqual(f.writes.map(w => w.model), ['audit', 'deleteUser']);
});

test('inactive users cannot log in and old tokens remain invalid after reactivation', async () => {
  const f = fixture(); f.user.isActive = false;
  await assert.rejects(new AuthService(f.db).login({ email: f.user.email, password: 'Password!' }), /deactivated/);
  const request = { cookies: { auth_token: 'old-token' }, headers: {}, jwtVerify: async () => ({ id: f.user.id, authVersion: 0 }), server: { prisma: f.db } };
  await assert.rejects(authenticate(request as any, {} as any), /deactivated/);
  f.user.isActive = true; f.user.authVersion = 1;
  await assert.rejects(authenticate(request as any, {} as any), /session revoked/);
});
