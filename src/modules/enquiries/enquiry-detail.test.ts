import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { PrismaClient } from '@prisma/client';
import { enquiryRoutes } from './enquiry.routes.js';
import { EnquiryService } from './enquiry.service.js';
import { errorHandler } from '../../middleware/error.middleware.js';

async function fixture(role: string | null = 'telecaller', found = true, source = true) {
  const user = { id: 'staff-1', email: 'staff@example.com', name: 'Staff', role, branch: 'branch-1', banned: false };
  const enquiry = {
    id: 'enquiry-1', candidateName: 'Example', phone: '1234567890', address: 'Example address',
    assignedToUserId: 'staff-1', branchId: 'other-branch', source: 'Referral',
    enquirySource: source ? { id: 'source-1', name: 'Referral' } : null,
    preferredCourse: { id: 'course-1', name: 'Solar', courseFee: 150000 },
    service: { id: 'service-1', name: 'Installation', price: 1000 },
    createdBy: { id: 'admin-1', name: 'Admin', role: 'admin' },
    assignedBy: { id: 'admin-1', name: 'Admin', role: 'admin' },
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-02T00:00:00.000Z'),
    lastContactDate: new Date('2026-10-03T00:00:00.000Z'),
  };
  const prisma = {
    user: { findUnique: async () => user },
    enquiry: {
      findUnique: async () => found ? enquiry : null,
      update: async () => enquiry,
      delete: async () => enquiry,
    },
    notification: { create: async () => ({}) },
  } as unknown as PrismaClient;
  const app = Fastify();
  app.decorate('prisma', prisma);
  app.setErrorHandler(errorHandler);
  await app.register(cookie);
  await app.register(jwt, { secret: 'enquiry-detail-test-secret' });
  await app.register(enquiryRoutes, { prefix: '/api/v1/enquiries' });
  const headers = { authorization: `Bearer ${app.jwt.sign(user)}` };
  return { app, headers, user, enquiry, service: new EnquiryService(prisma) };
}

test('assigned staff can load enquiry details with fields needed by all three screens', async (t) => {
  const { app, headers } = await fixture();
  t.after(() => app.close());
  const response = await app.inject({ url: '/api/v1/enquiries/enquiry-1', headers });
  assert.equal(response.statusCode, 200);
  const { data } = response.json();
  assert.equal(data.candidateName, 'Example');
  assert.equal(data.address, 'Example address');
  assert.equal(data.preferredCourse.courseFee, 150000);
  assert.equal(data.enquirySource.id, 'source-1');
  assert.equal(data.requiredService.price, 1000);
  assert.equal(data.createdBy.role, 'admin');
  assert.equal(data.assignedBy.role, 'admin');
  assert.equal(data.lastContactDate, '2026-10-03T00:00:00.000Z');
});

for (const role of ['admin', 'manager', 'executive', 'branch manager']) {
  test(`${role} keeps the existing detail access regardless of assignment or branch`, async (t) => {
    const { app, headers, enquiry } = await fixture(role);
    t.after(() => app.close());
    enquiry.assignedToUserId = 'other-staff';
    const response = await app.inject({ url: '/api/v1/enquiries/enquiry-1', headers });
    assert.equal(response.statusCode, 200);
  });
}

for (const role of ['telecaller', 'staff', null]) {
  test(`${role} cannot load another user's enquiry`, async (t) => {
    const { app, headers, enquiry } = await fixture(role);
    t.after(() => app.close());
    enquiry.assignedToUserId = 'other-staff';
    const response = await app.inject({ url: '/api/v1/enquiries/enquiry-1', headers });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.message, 'Access denied');
    assert.equal(response.json().data, undefined);
  });
}

test('a missing enquiry returns 404', async (t) => {
  const { app, headers } = await fixture('admin', false);
  t.after(() => app.close());
  const response = await app.inject({ url: '/api/v1/enquiries/missing', headers });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.message, 'Enquiry not found');
});

test('detail requests require a valid login token', async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  for (const headers of [{}, { authorization: 'Bearer invalid' }]) {
    const response = await app.inject({ url: '/api/v1/enquiries/enquiry-1', headers });
    assert.equal(response.statusCode, 401);
  }
});

test('legacy source names are preserved', async (t) => {
  const { app, headers } = await fixture('admin', true, false);
  t.after(() => app.close());
  const response = await app.inject({ url: '/api/v1/enquiries/enquiry-1', headers });
  assert.deepEqual(response.json().data.enquirySource, { id: 'Referral', name: 'Referral' });
});

test('internal update, status and delete operations still use the enquiry lookup', async (t) => {
  const { app, service } = await fixture();
  t.after(() => app.close());
  assert.equal((await service.updateEnquiry('enquiry-1', { notes: 'Updated' }, { id: 'admin-1', role: 'admin' })).id, 'enquiry-1');
  assert.equal((await service.changeStatus('enquiry-1', { status: 'CONTACTED' }, 'admin-1')).id, 'enquiry-1');
  assert.equal((await service.deleteEnquiry('enquiry-1', { id: 'admin-1', role: 'admin' })).id, 'enquiry-1');
});
