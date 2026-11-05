import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { PrismaClient } from '@prisma/client';
import { authenticate } from '../../middleware/auth.middleware.js';
import { errorHandler } from '../../middleware/error.middleware.js';
import { invoiceRoutes } from '../invoices/invoice.routes.js';
import { InvoiceService } from '../invoices/invoice.service.js';
import { decimal } from '../../shared/utils/money.js';
import { createInvoiceActionsService } from './invoice-actions.service.js';
import { createFeeCollectionActionsService } from './fee-collection-actions.service.js';
import { createProposalProposalActionsService } from './proposal-proposal-actions.service.js';
import type { WorkflowUser } from './workflow-user.js';

const admin = { id: 'admin-1', role: 'admin', name: 'Admin', branch: null } as WorkflowUser;

test('invoice endpoints reject users without the feature, including stale JWT grants', async t => {
  const app = Fastify();
  t.after(() => app.close());
  const user = { id: 'u', email: 'test@example.com', name: 'Test', branch: null, role: 'accounts', banned: false, userRole: { permissions: [] } };
  app.decorate('prisma', { user: { findUnique: async () => user } } as unknown as PrismaClient);
  await app.register(cookie);
  await app.register(jwt, { secret: 'invoice-permission-regression-secret' });
  app.setErrorHandler(errorHandler);
  await app.register(invoiceRoutes);
  const headers = { authorization: `Bearer ${app.jwt.sign({ ...user, permissions: ['invoices'] })}` };
  const routes = [
    ['GET', '/'], ['GET', '/i'], ['GET', '/i/pdf'], ['GET', '/payment-settings'],
    ['GET', '/payment-settings/next-number'], ['POST', '/i/share'], ['DELETE', '/i/share'],
    ['PUT', '/i/reminders'], ['POST', '/i/reminders/send'], ['POST', '/i/send'],
    ['POST', '/'], ['PATCH', '/i'], ['DELETE', '/i'], ['POST', '/i/payments'],
    ['DELETE', '/i/payments/p'], ['POST', '/i/items'], ['PATCH', '/items/item'],
    ['DELETE', '/items/item'], ['PUT', '/payment-settings'],
  ] as const;
  for (const [method, url] of routes) {
    const response = await app.inject({ method, url, headers });
    assert.equal(response.statusCode, 403, `${method} ${url}: ${response.body}`);
  }
});

for (const role of ['accounts', 'custom']) {
  test(`${role} with invoice permission can read invoices and reach write validation`, async t => {
    const app = Fastify();
    t.after(() => app.close());
    const user = { id: 'u', email: 'test@example.com', name: 'Test', branch: null, role, banned: false, userRole: { permissions: ['invoices'] } };
    app.decorate('prisma', {
      user: { findUnique: async () => user },
      invoice: { findMany: async () => [], count: async () => 0 },
    } as unknown as PrismaClient);
    await app.register(cookie);
    await app.register(jwt, { secret: 'invoice-permission-regression-secret' });
    app.setErrorHandler(errorHandler);
    await app.register(invoiceRoutes);
    const headers = { authorization: `Bearer ${app.jwt.sign({ ...user, permissions: [] })}` };
    assert.equal((await app.inject({ url: '/', headers })).statusCode, 200);
    for (const [method, url] of [['POST', '/'], ['PATCH', '/i'], ['POST', '/i/payments'], ['POST', '/i/items'], ['PUT', '/payment-settings']] as const) {
      const response = await app.inject({ method, url, headers, payload: { billedTo: '' } });
      assert.equal(response.statusCode, 400, `${method} ${url}: ${response.body}`);
    }
  });
}

test('authentication replaces token grants with the current database permissions', async t => {
  const app = Fastify();
  t.after(() => app.close());
  const user = { id: 'u', email: 'test@example.com', name: 'Test', branch: null, role: 'custom', banned: false, userRole: { permissions: ['dashboard'] } };
  app.decorate('prisma', { user: { findUnique: async () => user } } as unknown as PrismaClient);
  await app.register(cookie);
  await app.register(jwt, { secret: 'permission-refresh-regression-secret' });
  app.get('/permissions', { preHandler: authenticate }, request => request.currentUser.permissions);
  const headers = { authorization: `Bearer ${app.jwt.sign({ ...user, permissions: ['invoices', '*'] })}` };
  const response = await app.inject({ url: '/permissions', headers });
  assert.deepEqual(response.json(), ['dashboard']);
});

function invoiceFixture(amountPaid = 50) {
  const invoice = {
    id: 'i', invoiceNumber: 'INV-1', subtotal: decimal(100), taxRate: decimal(0),
    taxAmount: decimal(0), totalAmount: decimal(100), balanceDue: decimal(100 - amountPaid),
    serviceCharge: decimal(0), otherCharges: decimal(0), discountAmount: decimal(0),
    withholdingAmount: decimal(0), amountPaid: decimal(amountPaid), status: 'PARTIALLY_PAID',
    items: [], payments: [{ id: 'p', amount: amountPaid }], shareToken: 'shared', remindersEnabled: true,
  };
  let saved: Record<string, unknown> = {};
  const activities: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: async () => [{ id: invoice.id }],
    invoice: {
      findUnique: async () => invoice,
      update: async ({ data }: { data: Record<string, unknown> }) => { saved = data; return { ...invoice, ...data }; },
      findUniqueOrThrow: async () => ({ ...invoice, ...saved }),
    },
    invoiceActivity: { create: async ({ data }: { data: Record<string, unknown> }) => { activities.push(data); } },
    invoiceItem: { findMany: async () => [{ lineTotal: decimal(100) }] },
  };
  const prisma = { $transaction: async <T>(run: (client: typeof tx) => Promise<T>) => run(tx) } as unknown as PrismaClient;
  return { prisma, invoice, saved: () => saved, activities };
}

for (const workflow of [false, true]) {
  test(`${workflow ? 'workflow' : 'REST'} cancellation retains payments and disables public sharing`, async () => {
    const db = invoiceFixture();
    if (workflow) await createInvoiceActionsService(db.prisma, admin).deleteInvoice({ id: 'i' });
    else await new InvoiceService(db.prisma).deleteInvoice('i', admin.id);
    assert.equal(db.saved().status, 'CANCELLED');
    assert.equal(db.saved().shareToken, null);
    assert.equal(db.saved().remindersEnabled, false);
    assert.equal(db.invoice.payments.length, 1);
    assert.equal(db.activities[0].type, 'cancelled');
  });
}

test('workflow monetary edits synchronize total, outstanding balance and paid status', async () => {
  const db = invoiceFixture();
  await createInvoiceActionsService(db.prisma, admin).updateInvoice({ id: 'i', serviceCharge: 20 });
  assert.equal(String(db.saved().totalAmount), '120');
  assert.equal(String(db.saved().balanceDue), '70');
  assert.equal(db.saved().status, 'PARTIALLY_PAID');
  await createInvoiceActionsService(db.prisma, admin).updateInvoice({ id: 'i', serviceCharge: 0, taxRate: 0, status: 'PAID' });
  assert.equal(db.saved().status, 'PARTIALLY_PAID');
});

test('workflow invoice edits cannot reduce totals below recorded payments', async () => {
  const db = invoiceFixture(110);
  await assert.rejects(createInvoiceActionsService(db.prisma, admin).updateInvoice({ id: 'i', taxRate: 0 }), /already paid/);
  assert.deepEqual(db.saved(), {});
});

test('workflow explicit recalculation also updates the outstanding balance', async () => {
  const db = invoiceFixture();
  await createInvoiceActionsService(db.prisma, admin).calculateInvoiceTotals({ id: 'i' });
  assert.equal(String(db.saved().balanceDue), '50');
});

function receiptFixture() {
  let amount = decimal(40);
  let removed = false;
  let locked = false;
  let saved: Record<string, unknown> = {};
  const tx = {
    $queryRaw: async () => { locked = true; return []; },
    receipt: {
      findUnique: async () => ({ id: 'r', admissionId: 'a', amountCollected: amount }),
      update: async ({ data }: { data: { amountCollected?: number } }) => {
        assert.equal(locked, true);
        amount = decimal(data.amountCollected ?? amount);
        return { id: 'r', amountCollected: amount };
      },
      delete: async () => { assert.equal(locked, true); removed = true; },
    },
    admission: {
      findUnique: async () => ({
        id: 'a', status: 'CONFIRMED', agentCommission: decimal(10),
        course: { courseFee: decimal(100) },
        receipts: [...(removed ? [] : [{ id: 'r', amountCollected: amount }]), { id: 'other', amountCollected: decimal(20) }],
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => { saved = data; },
    },
  };
  const prisma = { $transaction: async <T>(run: (client: typeof tx) => Promise<T>) => run(tx) } as unknown as PrismaClient;
  return { service: createFeeCollectionActionsService(prisma, admin), amount: () => amount, saved: () => saved };
}

const receiptEdit = { id: 'r', paymentDate: new Date(), nextDueDate: new Date() };
test('receipt overpayment is rejected before any write, including other payments and commission', async () => {
  const db = receiptFixture();
  const result = await db.service.updateReceipt({ ...receiptEdit, amountCollected: 71 });
  assert.ok('error' in result);
  assert.equal(db.amount().toString(), '40');
  assert.deepEqual(db.saved(), {});
});

test('receipt edits update the balance and clear the due date when fully paid', async () => {
  const db = receiptFixture();
  const result = await db.service.updateReceipt({ ...receiptEdit, amountCollected: 70 });
  assert.equal('success' in result && result.success, true);
  assert.equal(String(db.saved().balance), '0');
  assert.equal(db.saved().nextDueDate, null);
  assert.equal(db.saved().status, 'CONFIRMED');
});

test('receipt deletion uses the admission commission when restoring the balance', async () => {
  const db = receiptFixture();
  assert.equal((await db.service.deleteReceipt('r')).success, true);
  assert.equal(String(db.saved().balance), '70');
  assert.equal(db.saved().status, 'PENDING');
});

for (const changes of [{ taxRate: 10 }, { discountAmount: 20 }, { taxRate: 10, discountAmount: 20 }]) {
  test(`proposal financial edits recalculate totals without replacement items: ${JSON.stringify(changes)}`, async () => {
    let saved: Record<string, unknown> = {};
    const proposal = { id: 'p', subtotal: decimal(100), taxRate: decimal(0), discountAmount: decimal(0), totalAmount: decimal(100), items: [] };
    const tx = { $queryRaw: async () => [], proposal: { findUnique: async () => proposal, update: async ({ data }: { data: Record<string, unknown> }) => { saved = data; } } };
    const prisma = {
      proposal: { findUnique: async () => proposal },
      $transaction: async <T>(run: (client: typeof tx) => Promise<T>) => run(tx),
    } as unknown as PrismaClient;
    const result = await createProposalProposalActionsService(prisma, admin).updateProposal({ id: 'p', ...changes });
    assert.equal(result.success, true);
    const tax = changes.taxRate ?? 0;
    const discount = changes.discountAmount ?? 0;
    assert.equal(String(saved.taxAmount), String(tax));
    assert.equal(String(saved.totalAmount), String(100 + tax - discount));
  });
}

test('proposal numbering handles gaps, concurrent creation and existing enquiry notes', async () => {
  const prefix = `PROP-${new Date().getFullYear()}-`;
  const numbers = [`${prefix}0001`, `${prefix}0003`];
  const enquiryUpdates: Record<string, unknown>[] = [];
  let queue = Promise.resolve();
  const tx = {
    $queryRaw: async (query: TemplateStringsArray) => { assert.match(query.join(''), /pg_advisory_xact_lock/); return []; },
    proposal: {
      findMany: async () => numbers.map(proposalNo => ({ proposalNo })),
      create: async ({ data }: { data: { proposalNo: string } }) => {
        assert.equal(numbers.includes(data.proposalNo), false);
        numbers.push(data.proposalNo);
        return { ...data, id: data.proposalNo };
      },
    },
  };
  const prisma = {
    $transaction: <T>(run: (client: typeof tx) => Promise<T>) => {
      const pending = queue.then(() => run(tx));
      queue = pending.then(() => undefined);
      return pending;
    },
    enquiry: { update: async ({ data }: { data: Record<string, unknown> }) => { enquiryUpdates.push(data); } },
  } as unknown as PrismaClient;
  const service = createProposalProposalActionsService(prisma, admin);
  const input = { clientName: 'Customer', enquiryId: 'e', items: [{ description: 'Panel', quantity: 1, unitPrice: 100 }] };
  const results = await Promise.all([service.createProposal(input), service.createProposal(input)]);
  assert.ok(results.every(result => result.success));
  assert.deepEqual(numbers.slice(2), [`${prefix}0004`, `${prefix}0005`]);
  assert.equal(enquiryUpdates.length, 2);
  for (const update of enquiryUpdates) {
    assert.equal('notes' in update, false);
    assert.ok(update.lastContactDate instanceof Date);
  }
});

test('financial edits and recalculation do not reactivate cancelled invoices', async () => {
  const db = invoiceFixture();
  db.invoice.status = 'CANCELLED';
  const service = createInvoiceActionsService(db.prisma, admin);
  await service.updateInvoice({ id: 'i', serviceCharge: 20 });
  assert.equal(db.saved().status, 'CANCELLED');
  await service.calculateInvoiceTotals({ id: 'i' });
  assert.equal(db.saved().status, 'CANCELLED');
});
