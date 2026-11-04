import assert from 'node:assert/strict';
import test from 'node:test';
import { InvoiceStatus, Prisma, type PrismaClient } from '@prisma/client';
import { decimal, roundMoney } from '../../shared/utils/money.js';
import { moneySchema } from '../../shared/utils/money.schemas.js';
import { formatCurrency } from '../../utils/format.js';
import { ReceiptTemplateMapper } from '../../services/pdf/receipt-template-mapper.js';
import { createPaymentSchema, updateInvoiceSchema } from './invoice.schema.js';
import { recordPaymentTx } from './invoice-workflow.service.js';
import { InvoiceService } from './invoice.service.js';
import { createReportActionsService } from '../workflows/report-actions.service.js';
import type { WorkflowUser } from '../workflows/workflow-user.js';

test('decimal money adds fractions exactly and rounds half cents consistently', () => {
  assert.equal(decimal('0.1').plus('0.2').toString(), '0.3');
  assert.equal(roundMoney('1.005').toString(), '1.01');
  assert.equal(roundMoney('-1.005').toString(), '-1.01');
});

test('money validation preserves exact strings and accepts existing numeric callers', () => {
  assert.equal(moneySchema.parse('999999999999999.9999').toString(), '999999999999999.9999');
  assert.equal(moneySchema.parse(0.1).toString(), '0.1');
  for (const value of ['', 'NaN', 'Infinity', '1.00001', '1000000000000000', Infinity, NaN]) {
    assert.equal(moneySchema.safeParse(value).success, false);
  }
});

test('invoice totals and tax use decimal arithmetic for fractional prices', async () => {
  let saved: Prisma.InvoiceUpdateArgs['data'] | undefined;
  const existing = {
    subtotal: decimal('0.1'), totalAmount: decimal('0.1'), taxRate: decimal(0),
    discountAmount: decimal(0), withholdingAmount: decimal(0),
    serviceCharge: decimal(0), otherCharges: decimal(0), amountPaid: decimal(0), payments: [],
  };
  const tx = {
    $queryRaw: async (): Promise<unknown[]> => [],
    invoice: {
      findUnique: async (): Promise<typeof existing> => existing,
      update: async ({ data }: Prisma.InvoiceUpdateArgs): Promise<void> => { saved = data; },
      findUniqueOrThrow: async (): Promise<typeof saved> => saved,
    },
    invoiceItem: {
      deleteMany: async (): Promise<void> => {},
      createMany: async (): Promise<void> => {},
    },
  };
  const client = {
    $transaction: async (run: (value: typeof tx) => Promise<unknown>): Promise<unknown> => run(tx),
  } as unknown as PrismaClient;
  await new InvoiceService(client).updateInvoice('invoice-1', updateInvoiceSchema.parse({
    items: [{ itemDescription: 'Fractional price', quantity: 3, unitPrice: '0.1' }],
    taxRate: '0.18',
  }), 'user-1');
  assert.equal(String(saved?.subtotal), '0.3');
  assert.equal(String(saved?.taxAmount), '0.05');
  assert.equal(String(saved?.totalAmount), '0.35');
  assert.equal(String(saved?.balanceDue), '0.35');
});

function paymentFixture(): {
  tx: Prisma.TransactionClient;
  saved: () => Prisma.InvoiceUpdateArgs['data'] | undefined;
} {
  let saved: Prisma.InvoiceUpdateArgs['data'] | undefined;
  const tx = {
    $queryRaw: async (): Promise<unknown[]> => [],
    invoice: {
      findUnique: async () => ({
        totalAmount: decimal('0.3'), amountPaid: decimal('0.1'),
        status: InvoiceStatus.SENT, customerId: null,
      }),
      update: async ({ data }: Prisma.InvoiceUpdateArgs): Promise<void> => { saved = data; },
    },
    paymentNumberSettings: {
      upsert: async (): Promise<void> => {},
      findUniqueOrThrow: async () => ({ autoGenerate: false }),
    },
    payment: {
      findUnique: async (): Promise<null> => null,
      create: async ({ data }: Prisma.PaymentCreateArgs) => ({ paymentNumber: data.paymentNumber }),
    },
    invoiceActivity: { create: async (): Promise<void> => {} },
  } as unknown as Prisma.TransactionClient;
  return { tx, saved: () => saved };
}

test('paying the exact fractional remainder clears the balance', async () => {
  const { tx, saved } = paymentFixture();
  const input = createPaymentSchema.parse({
    amount: '0.2', paymentNumber: 'PAY-1', paymentMode: 'CASH', paymentDate: '2026-10-30',
  });
  await recordPaymentTx(tx, 'invoice-1', input, 'user-1');
  assert.equal(String(saved()?.amountPaid), '0.3');
  assert.equal(String(saved()?.balanceDue), '0');
  assert.equal(saved()?.status, InvoiceStatus.PAID);
});

test('payments above the exact decimal balance fail before invoice updates', async () => {
  const { tx, saved } = paymentFixture();
  const input = createPaymentSchema.parse({ amount: '0.21', paymentMode: 'CASH' });
  await assert.rejects(recordPaymentTx(tx, 'invoice-1', input, 'user-1'), /balance due/);
  assert.equal(saved(), undefined);
});

test('currency formatting preserves large monetary strings', () => {
  assert.equal(formatCurrency('999999999999999.99', 'INR', 'en-IN'), '₹99,99,99,99,99,99,999.99');
});

test('receipt PDF mapping adds Decimal fees and receipts without concatenation', () => {
  const mapped = ReceiptTemplateMapper.mapToTemplateInputs({
    id: 'receipt-1', receiptNumber: 'RCP-1', amountCollected: decimal('0.1'),
    collectedTowards: 'COURSE_FEE', paymentDate: '2026-10-30', paymentMode: 'CASH',
    admission: {
      admissionNumber: 'ADM-1', candidateName: 'Test', nextDueDate: null,
      course: { name: 'Course', courseFee: decimal('0.1'), admissionFee: decimal('0.2'), semesterFee: null },
      receipts: [{ amountCollected: decimal('0.1') }],
    },
  });
  assert.equal(mapped.balanceFormatted, '₹0.20');
});

test('expense reports sum decimal amounts while keeping counts and percentages numeric', async () => {
  const client = {
    expense: {
      findMany: async () => ['0.1', '0.2'].map((amount) => ({
        amount: decimal(amount), category: 'OTHER', createdById: 'user-1', createdBy: { name: 'Test' },
      })),
    },
  } as unknown as PrismaClient;
  const user = { id: 'user-1', role: 'admin' } as WorkflowUser;
  const report = await createReportActionsService(client, user).getExpenseReport({});
  assert.equal(String(report.totalExpenses), '0.3');
  assert.equal(String(report.breakdown[0].totalAmount), '0.3');
  assert.equal(report.breakdown[0].percentage, 100);
  assert.equal(report.breakdown[0].transactionCount, 2);
});
