import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { createAuthService } from './auth.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { WorkflowUser } from './workflow-user.js';

const admin = { id: 'admin-1', role: 'admin', name: 'Admin', email: 'admin@example.com', branch: 'branch-1', userRole: null } as WorkflowUser;

test('user creation keeps credentials in the backend transaction and supports Fastify login', async () => {
  let created: any;
  let account: any;
  const role = { id: 'role_telecaller', name: 'telecaller' };
  const tx = {
    role: { findFirst: async () => role },
    user: {
      create: async ({ data }: any) => { created = { id: 'new-user', ...data }; return created; },
      update: async () => created,
      findUnique: async () => ({ ...created, userRole: role }),
    },
    account: { create: async ({ data }: any) => { account = data; return data; } },
  };
  const prisma = {
    role: { findFirst: async () => role },
    user: { findUnique: async () => created || null },
    $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  } as unknown as PrismaClient;
  const result = await createAuthService(prisma, admin).createUserAction({
    name: 'New Employee', email: 'EMPLOYEE@example.com', password: 'Password123!', confirmPassword: 'Password123!', role: 'telecaller', branch: 'branch-1',
  });
  assert.equal(result.success, true);
  assert.equal(created.email, 'employee@example.com');
  assert.equal('password' in result.user, false);
  assert.equal(account.userId, created.id);
  assert.equal(account.password, created.password);
  assert.equal(account.providerId, 'credential');
  assert.equal(await bcrypt.compare('Password123!', created.password), true);
  const login = await new AuthService(prisma).login({ email: 'employee@example.com', password: 'Password123!' });
  assert.equal(login.id, created.id);
  assert.equal('password' in login, false);
});

test('password confirmation is validated again by Fastify before any database write', async () => {
  const prisma = {} as PrismaClient;
  await assert.rejects(createAuthService(prisma, admin).createUserAction({
    name: 'New Employee', email: 'employee@example.com', password: 'Password123!', confirmPassword: 'Different123!', role: 'telecaller', branch: 'branch-1',
  }), /match/);
});

test('changing a password updates both credential stores in one transaction', async () => {
  const oldHash = await bcrypt.hash('OldPassword!', 4);
  const updates: any[] = [];
  let transactions = 0;
  const prisma = {
    user: { findUnique: async () => ({ id: admin.id, email: admin.email, password: oldHash }) },
    $transaction: async (run: (tx: any) => Promise<unknown>) => {
      transactions++;
      return run({
        user: { update: async (query: any) => { updates.push(query); } },
        account: { updateMany: async (query: any) => { updates.push(query); } },
      });
    },
  } as unknown as PrismaClient;
  const actions = createAuthService(prisma, admin);
  const wrong = await actions.changePasswordAction({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword!' });
  assert.equal(wrong.success, false);
  assert.equal(transactions, 0);
  const changed = await actions.changePasswordAction({ currentPassword: 'OldPassword!', newPassword: 'NewPassword!' });
  assert.equal(changed.success, true);
  assert.equal(transactions, 1);
  assert.equal(updates[0].data.password, updates[1].data.password);
  assert.equal(updates[1].where.userId, admin.id);
  assert.equal(await bcrypt.compare('NewPassword!', updates[0].data.password), true);
});
