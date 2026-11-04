import { decimal } from '../../shared/utils/money.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { InvoiceService } from './invoice.service.js';
import { updateInvoiceSchema } from './invoice.schema.js';

function fixture(amountPaid = 0, duplicateInvoiceNumber?: string) {
  let saved: Record<string, any> | undefined;
  const existing = {
    invoiceNumber: 'INV-OLD', customerId: 'customer-old', dueDate: new Date('2026-12-01T00:00:00.000Z'),
    subtotal: 1000, taxRate: 0.18, taxAmount: 180, totalAmount: 1180,
    serviceCharge: 0, otherCharges: 0, discountAmount: 0,
    withholdingAmount: 0, amountPaid, payments: [],
  };
  const tx = {
    $queryRaw: async () => [],
    invoice: {
      findUnique: async ({ where }: { where?: { id?: string; invoiceNumber?: string } } = {}) => {
        if (where?.invoiceNumber) return where.invoiceNumber === duplicateInvoiceNumber ? { id: 'another-invoice' } : null;
        return existing;
      },
      update: async ({ data }: { data: Record<string, any> }) => { saved = data; return data; },
      findUniqueOrThrow: async () => saved,
    },
    invoiceItem: {
      deleteMany: async () => ({}),
      createMany: async () => ({}),
    },
  };
  const client = { $transaction: async (run: (value: typeof tx) => Promise<unknown>) => run(tx) } as unknown as PrismaClient;
  return { service: new InvoiceService(client), saved: () => saved };
}

for (const rate of [0, 0.05, 0.12, 0.18, 0.1825, 0.28]) {
  test(`tax-only edit to ${rate * 100}% recalculates totals without resubmitting items`, async () => {
    const { service, saved } = fixture();
    const input = updateInvoiceSchema.parse({ taxRate: rate });
    await service.updateInvoice('invoice-1', input, 'admin-1');
    assert.equal(decimal(saved()?.taxRate).toString(), decimal(rate).toString());
    assert.equal(decimal(saved()?.taxAmount).toString(), decimal(1000 * rate).toString());
    assert.equal(decimal(saved()?.totalAmount).toString(), decimal(1000 + 1000 * rate).toString());
    assert.equal(decimal(saved()?.balanceDue).toString(), decimal(1000 + 1000 * rate).toString());
  });
}

test('omitting the tax rate preserves the existing rate', async () => {
  const { service, saved } = fixture();
  await service.updateInvoice('invoice-1', updateInvoiceSchema.parse({ notes: 'Updated' }), 'admin-1');
  assert.equal(decimal(saved()?.taxRate).toString(), decimal(0.18).toString());
  assert.equal(decimal(saved()?.taxAmount).toString(), decimal(180).toString());
});

test('changing items and tax together recalculates from the new subtotal', async () => {
  const { service, saved } = fixture();
  await service.updateInvoice('invoice-1', updateInvoiceSchema.parse({
    taxRate: 0.05,
    items: [{ itemDescription: 'Solar service', quantity: 2, unitPrice: 1000 }],
  }), 'admin-1');
  assert.equal(decimal(saved()?.subtotal).toString(), decimal(2000).toString());
  assert.equal(decimal(saved()?.taxAmount).toString(), decimal(100).toString());
  assert.equal(decimal(saved()?.totalAmount).toString(), decimal(2100).toString());
});

test('invoice discount reduces the taxable base before tax is added', async () => {
  const { service, saved } = fixture();
  await service.updateInvoice('invoice-1', updateInvoiceSchema.parse({ taxRate: 0.1825, discountAmount: 200, serviceCharge: 50, otherCharges: 20 }), 'admin-1');
  assert.equal(decimal(saved()?.taxAmount).toString(), decimal(146).toString());
  assert.equal(decimal(saved()?.totalAmount).toString(), decimal(1016).toString());
});

test('tax reduction updates a partially paid invoice balance', async () => {
  const { service, saved } = fixture(500);
  await service.updateInvoice('invoice-1', updateInvoiceSchema.parse({ taxRate: 0 }), 'admin-1');
  assert.equal(decimal(saved()?.balanceDue).toString(), decimal(500).toString());
  assert.equal(saved()?.status, 'PARTIALLY_PAID');
});

test('tax reduction cannot reduce the invoice below payments already recorded', async () => {
  const { service, saved } = fixture(1100);
  await assert.rejects(service.updateInvoice('invoice-1', updateInvoiceSchema.parse({ taxRate: 0 }), 'admin-1'), /already paid/);
  assert.equal(saved(), undefined);
});

test('invoice edits update the invoice number, customer, and clear the due date', async () => {
  const { service, saved } = fixture();
  await service.updateInvoice('invoice-1', updateInvoiceSchema.parse({
    invoiceNumber: 'INV-NEW', customerId: 'customer-new', billedTo: 'New Customer', dueDate: null,
  }), 'admin-1');
  assert.equal(saved()?.invoiceNumber, 'INV-NEW');
  assert.equal(saved()?.customerId, 'customer-new');
  assert.equal(saved()?.billedTo, 'New Customer');
  assert.equal(saved()?.dueDate, null);
});

test('duplicate invoice numbers are rejected', async () => {
  const { service, saved } = fixture(0, 'INV-TAKEN');
  await assert.rejects(service.updateInvoice('invoice-1', updateInvoiceSchema.parse({ invoiceNumber: 'INV-TAKEN' }), 'admin-1'), /already in use/);
  assert.equal(saved(), undefined);
});

test('payment-derived statuses cannot be assigned without a recorded payment', async () => {
  const { service, saved } = fixture();
  await assert.rejects(service.updateInvoice('invoice-1', updateInvoiceSchema.parse({ status: 'PAID' }), 'admin-1'), /Record a payment/);
  assert.equal(saved(), undefined);
});
