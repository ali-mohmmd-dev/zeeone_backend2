import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { EnquiryService } from './enquiry.service.js';
import { EnquiryController } from './enquiry.controller.js';
import { enquiryFilterSchema } from './enquiry.schema.js';

const admin = { id: 'admin-1', role: 'admin', branch: null };

function fixture() {
  let query: Prisma.EnquiryFindManyArgs | undefined;
  let countWhere: Prisma.EnquiryWhereInput | undefined;
  const prisma = {
    enquiry: {
      findMany: async (args: Prisma.EnquiryFindManyArgs) => {
        query = args;
        return [{
          id: 'enquiry-1', candidateName: 'Example', source: 'Referral',
          enquirySource: null, service: { id: 'service-1', name: 'Installation' },
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          updatedAt: new Date('2026-10-01T00:00:00.000Z'),
        }];
      },
      count: async ({ where }: { where: Prisma.EnquiryWhereInput }) => {
        countWhere = where;
        return 41;
      },
    },
  } as unknown as PrismaClient;
  return { prisma, service: new EnquiryService(prisma), query: () => query!, countWhere: () => countWhere };
}

test('list filters, sorting and pagination are applied to rows and count', async () => {
  const { service, query, countWhere } = fixture();
  await service.listEnquiries(enquiryFilterSchema.parse({
    page: '2', limit: '10', search: ' Example ', status: 'NEW,CONTACTED',
    branchId: 'branch-1', enquirySourceId: 'source-1', assignedToUserId: 'staff-1',
    isAssigned: 'true', dateFrom: '2026-10-01T00:00:00.000Z',
    dateTo: '2026-10-29T00:00:00.000Z', sortBy: 'candidateName', sortOrder: 'asc',
  }), admin);
  assert.equal(query().skip, 10);
  assert.equal(query().take, 10);
  assert.deepEqual(query().orderBy, { candidateName: 'asc' });
  assert.deepEqual(query().where?.status, { in: ['NEW', 'CONTACTED'] });
  assert.equal(query().where?.branchId, 'branch-1');
  assert.equal(query().where?.assignedToUserId, 'staff-1');
  assert.deepEqual(query().where?.AND, [
    {}, { assignedToUserId: { not: null } },
    { OR: [{ sourceId: 'source-1' }, { source: 'source-1' }] },
  ]);
  assert.deepEqual(query().where?.createdAt, {
    gte: new Date('2026-10-01T00:00:00.000Z'), lte: new Date('2026-10-29T00:00:00.000Z'),
  });
  const nameFilter = query().where?.OR?.[0]?.candidateName as Prisma.StringFilter;
  assert.equal(nameFilter.contains, 'Example');
  assert.deepEqual(countWhere(), query().where);
});

test('staff filters cannot replace assigned-user access restrictions', async () => {
  const { service, query } = fixture();
  await service.listEnquiries(enquiryFilterSchema.parse({ assignedToUserId: 'other-user', isAssigned: 'false' }),
    { id: 'staff-1', role: 'telecaller', branch: 'branch-1' });
  assert.deepEqual(query().where?.AND, [{ assignedToUserId: 'staff-1' }, { assignedToUserId: null }]);
  assert.equal(query().where?.assignedToUserId, 'other-user');
});

for (const role of ['manager', 'executive', 'branch manager']) {
  test(`${role} filters cannot replace branch restrictions`, async () => {
    const { service, query } = fixture();
    await service.listEnquiries(enquiryFilterSchema.parse({ branchId: 'other-branch' }),
      { id: 'manager-1', role, branch: 'branch-1' });
    assert.deepEqual(query().where?.AND, [{ branchId: 'branch-1' }]);
    assert.equal(query().where?.branchId, 'other-branch');
  });
}

test('a manager without a branch cannot list all enquiries', async () => {
  const { service, query } = fixture();
  await service.listEnquiries(enquiryFilterSchema.parse({}), { ...admin, role: 'manager' });
  assert.deepEqual(query().where?.AND, [{ id: { in: [] } }]);
});

test('invalid status, assignment, pagination and sorting values are rejected', () => {
  for (const query of [{ status: 'UNKNOWN' }, { isAssigned: 'yes' }, { page: '1.5' }, { limit: '101' }, { sortBy: 'password' }]) {
    assert.equal(enquiryFilterSchema.safeParse(query).success, false);
  }
});

test('HTTP list response includes pagination and frontend relation names', async () => {
  const { prisma } = fixture();
  const app = Fastify();
  app.decorate('prisma', prisma);
  app.get('/api/v1/enquiries', {
    preHandler: async (request) => { request.user = { ...admin, email: 'admin@example.com', name: 'Admin' }; },
  }, EnquiryController.listEnquiries);
  try {
    const response = await app.inject('/api/v1/enquiries?page=2&limit=20');
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.deepEqual(body.pagination, { page: 2, limit: 20, total: 41, totalPages: 3 });
    assert.deepEqual(body.data[0].enquirySource, { id: 'Referral', name: 'Referral' });
    assert.equal(body.data[0].requiredService.name, 'Installation');
    assert.equal(body.data[0].createdAt, '2026-10-01T00:00:00.000Z');
  } finally {
    await app.close();
  }
});
