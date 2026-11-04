import assert from 'node:assert/strict';
import test from 'node:test';
import { InvoiceStatus } from '@prisma/client';
import { calculateInvoicePaymentStatus, formatPaymentNumber, getIndiaFiscalYear } from './payment.utils.js';

test('payment number uses configured prefix and padding', () => {
  assert.equal(formatPaymentNumber('PAY-', 1, 6), 'PAY-000001');
});

test('fiscal-year payment numbers include the Indian fiscal year to remain unique after restart', () => {
  assert.equal(formatPaymentNumber('PAY-', 1, 6, 2026), 'PAY-2026-27-000001');
});

test('India fiscal year starts on 1 April', () => {
  assert.equal(getIndiaFiscalYear(new Date('2026-03-31T12:00:00Z')), 2025);
  assert.equal(getIndiaFiscalYear(new Date('2026-04-01T00:00:00Z')), 2026);
});

test('payment status moves from partial to paid at the exact total', () => {
  assert.equal(calculateInvoicePaymentStatus(5000, 2000), InvoiceStatus.PARTIALLY_PAID);
  assert.equal(calculateInvoicePaymentStatus(5000, 5000), InvoiceStatus.PAID);
  assert.equal(calculateInvoicePaymentStatus(5000, 5000.004), InvoiceStatus.PAID);
  assert.equal(calculateInvoicePaymentStatus(5000, 0), null);
});
