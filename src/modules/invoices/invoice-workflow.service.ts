import { decimal } from '../../shared/utils/money.js';
import { randomBytes } from 'node:crypto';
import { InvoiceStatus, Prisma, PrismaClient } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import { CreatePaymentInput, PaymentSettingsInput } from './invoice.schema.js';
import { calculateInvoicePaymentStatus, formatPaymentNumber, getIndiaFiscalYear, roundMoney } from './payment.utils.js';

const DEFAULT_SETTINGS_ID = 'default';

export async function recordPaymentTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  input: CreatePaymentInput,
  userId: string,
  options: { allowDraft?: boolean; manualPaymentNumber?: string } = {},
) {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice');
  if (!options.allowDraft && (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.CANCELLED)) {
    throw new BadRequestError('Payments cannot be recorded for draft or cancelled invoices');
  }
  const amount = roundMoney(input.amount);
  const balanceDue = roundMoney(decimal(invoice.totalAmount).minus(invoice.amountPaid));
  if (amount.lessThanOrEqualTo(0) || amount.greaterThan(balanceDue)) {
    throw new BadRequestError(`Payment must be greater than zero and no more than the balance due (${balanceDue.toFixed(2)})`);
  }
  const paymentNumber = await issuePaymentNumber(tx, input.paymentDate, options.manualPaymentNumber ?? input.paymentNumber);
  const payment = await tx.payment.create({
    data: {
      invoiceId,
      customerId: invoice.customerId,
      paymentNumber,
      paymentDate: new Date(input.paymentDate),
      amount,
      paymentMode: input.paymentMode,
      depositTo: input.depositTo || null,
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      createdByUserId: userId,
    },
  });
  const amountPaid = roundMoney(decimal(invoice.amountPaid).plus(amount));
  const nextBalance = roundMoney(Prisma.Decimal.max(0, decimal(invoice.totalAmount).minus(amountPaid)));
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid, balanceDue: nextBalance, status: calculateInvoicePaymentStatus(invoice.totalAmount, amountPaid) ?? invoice.status },
  });
  await tx.invoiceActivity.create({
    data: { invoiceId, userId, type: 'payment_recorded', message: `Payment ${payment.paymentNumber} of ₹${amount.toFixed(2)} recorded` },
  });
  return payment;
}

async function issuePaymentNumber(tx: Prisma.TransactionClient, paymentDate: string | Date, manualNumber?: string) {
  await tx.paymentNumberSettings.upsert({ where: { id: DEFAULT_SETTINGS_ID }, create: { id: DEFAULT_SETTINGS_ID }, update: {} });
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "payment_number_settings" WHERE "id" = ${DEFAULT_SETTINGS_ID} FOR UPDATE`);
  const settings = await tx.paymentNumberSettings.findUniqueOrThrow({ where: { id: DEFAULT_SETTINGS_ID } });
  if (!settings.autoGenerate) {
    const value = manualNumber?.trim();
    if (!value) throw new BadRequestError('Enter a payment number or enable automatic numbering');
    if (await tx.payment.findUnique({ where: { paymentNumber: value } })) throw new BadRequestError('This payment number is already in use');
    return value;
  }

  const fiscalYear = getIndiaFiscalYear(new Date(paymentDate));
  const reset = settings.restartEachFiscalYear && settings.lastResetFiscalYear !== fiscalYear;
  let nextNumber = reset ? 1 : settings.nextNumber;
  let candidate = formatPaymentNumber(settings.prefix, nextNumber, settings.padding, settings.restartEachFiscalYear ? fiscalYear : undefined);
  while (await tx.payment.findUnique({ where: { paymentNumber: candidate } })) {
    nextNumber += 1;
    candidate = formatPaymentNumber(settings.prefix, nextNumber, settings.padding, settings.restartEachFiscalYear ? fiscalYear : undefined);
  }
  await tx.paymentNumberSettings.update({
    where: { id: DEFAULT_SETTINGS_ID },
    data: { nextNumber: nextNumber + 1, ...(reset ? { lastResetFiscalYear: fiscalYear } : {}) },
  });
  return candidate;
}

function previewNumber(settings: { autoGenerate: boolean; prefix: string; nextNumber: number; padding: number; restartEachFiscalYear: boolean; lastResetFiscalYear: number | null }, date = new Date()) {
  if (!settings.autoGenerate) return '';
  const fiscalYear = getIndiaFiscalYear(date);
  const next = settings.restartEachFiscalYear && settings.lastResetFiscalYear !== fiscalYear ? 1 : settings.nextNumber;
  return formatPaymentNumber(settings.prefix, next, settings.padding, settings.restartEachFiscalYear ? fiscalYear : undefined);
}

export class InvoiceWorkflowService {
  constructor(private prisma: PrismaClient) {}

  async recordPayment(invoiceId: string, input: CreatePaymentInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockInvoice(tx, invoiceId);
      const payment = await recordPaymentTx(tx, invoiceId, input, userId);
      return { payment, invoice: await this.getInvoice(tx, invoiceId) };
    });
  }

  async deletePayment(invoiceId: string, paymentId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockInvoice(tx, invoiceId);
      const [invoice, payment] = await Promise.all([
        tx.invoice.findUnique({ where: { id: invoiceId } }),
        tx.payment.findFirst({ where: { id: paymentId, invoiceId } }),
      ]);
      if (!invoice) throw new NotFoundError('Invoice');
      if (!payment) throw new NotFoundError('Payment');
      await tx.payment.delete({ where: { id: paymentId } });
      const aggregate = await tx.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
      const amountPaid = roundMoney(aggregate._sum.amount ?? 0);
      const balanceDue = roundMoney(Prisma.Decimal.max(0, decimal(invoice.totalAmount).minus(amountPaid)));
      const status = amountPaid.greaterThan(0)
        ? balanceDue.isZero() ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID
        : invoice.status === InvoiceStatus.CANCELLED ? invoice.status
          : invoice.dueDate && invoice.dueDate < new Date() ? InvoiceStatus.OVERDUE : InvoiceStatus.SENT;
      await tx.invoice.update({ where: { id: invoiceId }, data: { amountPaid, balanceDue, status } });
      await tx.invoiceActivity.create({ data: { invoiceId, userId, type: 'payment_deleted', message: `Payment ${payment.paymentNumber} of ₹${payment.amount.toFixed(2)} reversed` } });
      return this.getInvoice(tx, invoiceId);
    });
  }

  private async lockInvoice(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "invoice" WHERE "id" = ${id} FOR UPDATE`);
    if (!rows.length) throw new NotFoundError('Invoice');
  }

  private getInvoice(tx: Prisma.TransactionClient, id: string) {
    return tx.invoice.findUniqueOrThrow({ where: { id }, include: {
      items: true,
      payments: { orderBy: { paymentDate: 'asc' } },
      activities: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true } } } },
      customer: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, gstin: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    } });
  }

  async getSettings() {
    return this.prisma.paymentNumberSettings.upsert({ where: { id: DEFAULT_SETTINGS_ID }, create: { id: DEFAULT_SETTINGS_ID }, update: {} });
  }

  async updateSettings(input: PaymentSettingsInput) {
    return this.prisma.paymentNumberSettings.upsert({ where: { id: DEFAULT_SETTINGS_ID }, create: { id: DEFAULT_SETTINGS_ID, ...input }, update: input });
  }

  async getNextNumber() {
    const settings = await this.getSettings();
    return { paymentNumber: previewNumber(settings), settings };
  }

  async updateReminders(invoiceId: string, userId: string, remindersEnabled: boolean, reminderRules: string[]) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({ where: { id: invoiceId }, data: { remindersEnabled, reminderRules } });
      await tx.invoiceActivity.create({ data: { invoiceId, userId, type: 'reminders_updated', message: remindersEnabled ? 'Payment reminders enabled' : 'Payment reminders disabled' } });
      return invoice;
    });
  }

  async updateShareToken(invoiceId: string, userId: string, shareToken: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({ where: { id: invoiceId }, data: { shareToken } });
      await tx.invoiceActivity.create({ data: { invoiceId, userId, type: shareToken ? 'share_enabled' : 'share_revoked', message: shareToken ? 'Public invoice link created' : 'Public invoice link revoked' } });
      return invoice;
    });
  }

  async createShareToken(invoiceId: string, userId: string) {
    const token = randomBytes(32).toString('base64url');
    const invoice = await this.updateShareToken(invoiceId, userId, token);
    return { shareToken: invoice.shareToken };
  }

  async publicInvoice(token: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { shareToken: token }, select: {
      id: true, invoiceNumber: true, billedTo: true, invoiceDate: true, dueDate: true, subtotal: true, taxRate: true, taxAmount: true,
      serviceCharge: true, otherCharges: true, totalAmount: true, amountPaid: true, balanceDue: true, status: true, notes: true,
      items: true, customer: { select: { name: true, email: true, address: true } },
    } });
    if (!invoice) throw new NotFoundError('Shared invoice');
    return invoice;
  }
}
