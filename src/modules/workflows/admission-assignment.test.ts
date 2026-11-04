import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { createAdmissionActionsService } from './admission-actions.service.js';

function workflowUser(input: Partial<WorkflowUser> & Pick<WorkflowUser, 'id' | 'role'>) {
  return {
    name: input.id,
    email: `${input.id}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roleId: null,
    userRole: null,
    branch: null,
    banned: false,
    banReason: null,
    banExpires: null,
    image: null,
    password: null,
    ...input,
  } as WorkflowUser;
}

function serviceFor(user: WorkflowUser, overrides: Record<string, unknown> = {}) {
  const queries: Record<string, any[]> = { findMany: [], count: [], findFirst: [], findUnique: [], update: [] };
  const prisma = {
    admission: {
      async findMany(args: any) { queries.findMany.push(args); return []; },
      async count(args: any) { queries.count.push(args); return 0; },
      async findFirst(args: any) { queries.findFirst.push(args); return overrides.findFirstResult ?? null; },
      async findUnique(args: any) { queries.findUnique.push(args); return overrides.findUniqueResult ?? null; },
      async update(args: any) { queries.update.push(args); return { id: 'survey-1' }; },
    },
    user: {
      async findMany(args: any) { queries.userFindMany = args; return overrides.users ?? []; },
      async findUnique(args: any) { queries.userFindUnique = args; return overrides.assignee ?? null; },
    },
  } as unknown as PrismaClient;
  return { service: createAdmissionActionsService(prisma, user), queries };
}

test('project staff list only assigned surveys', async () => {
  const user = workflowUser({ id: 'staff-1', role: 'job_orders', permissions: ['projects'] });
  const { service, queries } = serviceFor(user);

  await service.getAdmissions({});

  assert.deepEqual(queries.findMany[0].where, {
    assignedToUserId: 'staff-1',
    status: { not: 'CANCELLED' },
  });
});

test('managers list surveys from their branch only', async () => {
  const user = workflowUser({ id: 'manager-1', role: 'manager', branch: 'branch-1' });
  const { service, queries } = serviceFor(user);

  await service.getAdmissions({});

  assert.deepEqual(queries.findMany[0].where, {
    OR: [
      { enquiry: { branchId: 'branch-1' } },
      { enquiryId: null, createdBy: { branch: 'branch-1' } },
    ],
    status: { not: 'CANCELLED' },
  });
});

test('admins see surveys without assignment or branch restrictions', async () => {
  const user = workflowUser({ id: 'admin-1', role: 'admin' });
  const { service, queries } = serviceFor(user);

  await service.getAdmissions({});

  assert.deepEqual(queries.findMany[0].where, { status: { not: 'CANCELLED' } });
});

test('direct survey lookup applies assignment scope to staff', async () => {
  const user = workflowUser({ id: 'staff-2', role: 'services', permissions: ['projects'] });
  const { service, queries } = serviceFor(user);

  await assert.rejects(service.getAdmissionById({ id: 'survey-1' }), /Failed to fetch admission/);

  assert.deepEqual(queries.findFirst[0].where, {
    AND: [{ id: 'survey-1' }, { assignedToUserId: 'staff-2' }],
  });
});

test('enquiry survey lookup applies branch scope to managers', async () => {
  const user = workflowUser({ id: 'manager-2', role: 'manager', branch: 'branch-2' });
  const { service, queries } = serviceFor(user);

  await service.getAdmissionsByEnquiry({ enquiryId: 'enquiry-1' });

  assert.deepEqual(queries.findMany[0].where, {
    AND: [{
      OR: [
        { enquiry: { branchId: 'branch-2' } },
        { enquiryId: null, createdBy: { branch: 'branch-2' } },
      ],
    }],
    enquiryId: 'enquiry-1',
    status: { not: 'CANCELLED' },
  });
});

test('creation requires an assignee before attempting database writes', async () => {
  const user = workflowUser({ id: 'admin-2', role: 'admin' });
  const { service, queries } = serviceFor(user);

  await assert.rejects(service.createAdmission({
    candidateName: 'Customer',
    mobileNumber: '1234567890',
    address: 'Site address',
    courseId: 'course-1',
  }));

  assert.equal(queries.findUnique.length, 0);
});

test('assignee list includes project users but excludes managers', async () => {
  const user = workflowUser({ id: 'admin-3', role: 'admin' });
  const { service } = serviceFor(user, {
    users: [
      { id: 'field-1', name: 'Field Staff', role: 'job_orders', branch: 'branch-1', banned: false, userRole: { permissions: ['projects'] } },
      { id: 'manager-3', name: 'Manager', role: 'manager', branch: 'branch-1', banned: false, userRole: { permissions: ['projects'] } },
      { id: 'sales-1', name: 'Sales', role: 'telecaller', branch: 'branch-1', banned: false, userRole: { permissions: ['enquiries'] } },
    ],
  });

  const result = await service.getSurveyAssignees();

  assert.deepEqual(result.data.map((assignee) => assignee.id), ['field-1']);
});

test('managers cannot assign surveys outside their branch', async () => {
  const user = workflowUser({ id: 'manager-4', role: 'manager', branch: 'branch-1' });
  const { service, queries } = serviceFor(user, {
    findFirstResult: { id: 'survey-1' },
    assignee: { id: 'field-2', role: 'job_orders', branch: 'branch-2', banned: false, userRole: { permissions: ['projects'] } },
  });

  await assert.rejects(service.reassignAdmission({ id: 'survey-1', assignedToUserId: 'field-2' }), /Select an active user/);
  assert.equal(queries.update.length, 0);
});

test('a manager can reassign a same-branch survey to eligible staff', async () => {
  const user = workflowUser({ id: 'manager-5', role: 'manager', branch: 'branch-1' });
  const { service, queries } = serviceFor(user, {
    findFirstResult: { id: 'survey-1' },
    assignee: { id: 'field-3', role: 'job_orders', branch: 'branch-1', banned: false, userRole: { permissions: ['projects'] } },
  });

  const result = await service.reassignAdmission({ id: 'survey-1', assignedToUserId: 'field-3' });

  assert.equal(result.success, true);
  assert.deepEqual(queries.update[0].data, { assignedTo: { connect: { id: 'field-3' } } });
});
