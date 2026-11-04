import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { Prisma, PrismaClient } from '@prisma/client';
import { enquiryRoutes } from './enquiry.routes.js';
import { errorHandler } from '../../middleware/error.middleware.js';

async function fixture(role = 'admin', branch: string | null = 'branch-1') {
  const user = { id: 'user-1', email: 'user@example.com', name: 'User', role, branch, banned: false };
  const enquiry = { id: 'enquiry-1', candidateName: 'Example', assignedToUserId: 'user-1', createdByUserId: 'user-1' };
  const state = {
    found: true,
    created: undefined as Prisma.EnquiryUncheckedCreateInput | undefined,
    updated: undefined as Prisma.EnquiryUncheckedUpdateInput | undefined,
    deleted: false,
  };
  const prisma = {
    user: { findUnique: async () => user },
    enquiry: {
      findUnique: async () => state.found ? enquiry : null,
      create: async ({ data }: { data: Prisma.EnquiryUncheckedCreateInput }) => {
        state.created = data;
        return { ...data, id: 'enquiry-new' };
      },
      update: async ({ data }: { data: Prisma.EnquiryUncheckedUpdateInput }) => {
        state.updated = data;
        return { ...enquiry, ...data };
      },
      delete: async () => { state.deleted = true; return enquiry; },
    },
    notification: { create: async () => ({}) },
  } as unknown as PrismaClient;
  const app = Fastify();
  app.decorate('prisma', prisma);
  app.setErrorHandler(errorHandler);
  await app.register(cookie);
  await app.register(jwt, { secret: 'enquiry-mutations-test-secret' });
  await app.register(enquiryRoutes, { prefix: '/api/v1/enquiries' });
  const headers = { authorization: `Bearer ${app.jwt.sign(user)}` };
  return { app, headers, state, enquiry };
}

const createInput = { candidateName: 'Example', phone: '9876543210', branchId: 'selected-branch' };

test('create saves the form relationships, notes, creator and assignee', async (t) => {
  const { app, headers, state } = await fixture();
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers, payload: {
    ...createInput, sourceId: 'source-1', serviceId: 'service-1', preferredCourseId: 'course-1',
    assignedToUserId: 'staff-2', createdByUserId: 'user-1', email: '',
    notes: '[Avg. KSEB Bill: 2000] Notes', address: 'Address\nDistrict/Panchayat: Example',
  } });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.id, 'enquiry-new');
  assert.equal(state.created?.branchId, 'selected-branch');
  assert.equal(state.created?.sourceId, 'source-1');
  assert.equal(state.created?.serviceId, 'service-1');
  assert.equal(state.created?.preferredCourseId, 'course-1');
  assert.equal(state.created?.status, 'NEW');
  assert.equal(state.created?.email, null);
  assert.equal(state.created?.createdByUserId, 'user-1');
  assert.equal(state.created?.assignedToUserId, 'staff-2');
  assert.equal(state.created?.assignedByUserId, 'user-1');
  assert.equal(state.created?.notes, '[Avg. KSEB Bill: 2000] Notes');
  assert.equal(state.created?.address, 'Address\nDistrict/Panchayat: Example');
});

for (const role of ['telecaller', 'manager', 'executive', 'branch manager']) {
  test(`${role} creation uses the user's branch`, async (t) => {
    const { app, headers, state } = await fixture(role);
    t.after(() => app.close());
    const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers, payload: createInput });
    assert.equal(response.statusCode, 201);
    assert.equal(state.created?.branchId, 'branch-1');
    assert.equal(state.created?.createdByUserId, 'user-1');
    if (role === 'telecaller') {
      assert.equal(state.created?.assignedToUserId, 'user-1');
      assert.equal(state.created?.assignedByUserId, 'user-1');
    }
  });
}

test('create requires a branch and validates phone, email and name', async (t) => {
  const { app, headers, state } = await fixture('admin', null);
  t.after(() => app.close());
  for (const payload of [
    { ...createInput, branchId: undefined }, { ...createInput, phone: '123' },
    { ...createInput, email: 'invalid' }, { ...createInput, candidateName: '' },
  ]) {
    const response = await app.inject({ method: 'POST', url: '/api/v1/enquiries', headers, payload });
    assert.equal(response.statusCode, 400);
  }
  assert.equal(state.created, undefined);
});

test('update clears optional fields without resetting status or changing assignment', async (t) => {
  const { app, headers, state } = await fixture();
  t.after(() => app.close());
  const response = await app.inject({ method: 'PATCH', url: '/api/v1/enquiries/enquiry-1', headers, payload: {
    email: '', notes: '', feedback: '', sourceId: null, serviceId: null, preferredCourseId: null,
    createdByUserId: 'other-user', assignedToUserId: 'other-user',
  } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(state.updated, { email: null, notes: '', feedback: '', sourceId: null, serviceId: null, preferredCourseId: null });
});

test('telecallers cannot update or delete another user\'s enquiry', async (t) => {
  const { app, headers, state, enquiry } = await fixture('telecaller');
  t.after(() => app.close());
  enquiry.assignedToUserId = 'other-user';
  for (const method of ['PATCH', 'DELETE'] as const) {
    const response = await app.inject({ method, url: '/api/v1/enquiries/enquiry-1', headers, ...(method === 'PATCH' ? { payload: { notes: 'Changed' } } : {}) });
    assert.equal(response.statusCode, 403);
  }
  assert.equal(state.updated, undefined);
  assert.equal(state.deleted, false);
});

test('executives cannot delete unrelated enquiries', async (t) => {
  const { app, headers, state, enquiry } = await fixture('executive');
  t.after(() => app.close());
  enquiry.assignedToUserId = 'other-user';
  enquiry.createdByUserId = 'other-user';
  const response = await app.inject({ method: 'DELETE', url: '/api/v1/enquiries/enquiry-1', headers });
  assert.equal(response.statusCode, 403);
  assert.equal(state.deleted, false);
});

for (const role of ['admin', 'manager', 'telecaller', 'executive']) {
  test(`${role} retains the form's permitted deletion`, async (t) => {
    const { app, headers, state } = await fixture(role);
    t.after(() => app.close());
    const response = await app.inject({ method: 'DELETE', url: '/api/v1/enquiries/enquiry-1', headers });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().success, true);
    assert.equal(state.deleted, true);
  });
}

test('missing records return 404 and mutation requests require login', async (t) => {
  const { app, headers, state } = await fixture();
  t.after(() => app.close());
  state.found = false;
  for (const method of ['PATCH', 'DELETE'] as const) {
    const response = await app.inject({ method, url: '/api/v1/enquiries/missing', headers, ...(method === 'PATCH' ? { payload: { notes: 'Changed' } } : {}) });
    assert.equal(response.statusCode, 404);
  }
  for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
    const response = await app.inject({ method, url: method === 'POST' ? '/api/v1/enquiries' : '/api/v1/enquiries/enquiry-1' });
    assert.equal(response.statusCode, 401);
  }
});
