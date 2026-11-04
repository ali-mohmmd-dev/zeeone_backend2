import { decimal, roundMoney } from '../../shared/utils/money.js';
﻿import { PrismaClient, Prisma, InvoiceStatus } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import { PDFService } from '../../services/pdf/pdf.service.js';
import { CreateInvoiceInput, InvoiceFilterInput, UpdateInvoiceInput } from './invoice.schema.js';
import { recordPaymentTx } from './invoice-workflow.service.js';

export class InvoiceService {
  constructor(private prisma: PrismaClient) {}

  async listInvoices(filters: InvoiceFilterInput) {
    const { search, status, startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};
    if (status) where.status = status as InvoiceStatus;

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { billedTo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          items: true,
          payments: { orderBy: { paymentDate: 'asc' } },
          activities: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true } } } },
          customer: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, gstin: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  async getInvoiceById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { paymentDate: 'asc' } },
        activities: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true } } } },
        customer: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, gstin: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!invoice) throw new NotFoundError('Invoice');
    return invoice;
  }

  async createInvoice(input: CreateInvoiceInput, currentUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Keep manually entered invoice numbers unique, otherwise assign one.
      let invoiceNumber = input.invoiceNumber ?? '';
      if (invoiceNumber) {
        const existing = await tx.invoice.findUnique({ where: { invoiceNumber } });
        if (existing) throw new BadRequestError('This invoice number is already in use');
      } else {
        const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
        let attempts = 0;
        do {
          const count = await tx.invoice.count();
          invoiceNumber = `INV-${datePrefix}-${String(count + attempts + 1).padStart(4, '0')}`;
          attempts += 1;
        } while (await tx.invoice.findUnique({ where: { invoiceNumber } }) && attempts < 10);
        if (await tx.invoice.findUnique({ where: { invoiceNumber } })) {
          throw new BadRequestError('Could not generate a unique invoice number');
        }
      }

      // Calculate totals
      let subtotal = decimal(0);
      const itemsWithTotals = input.items.map((item) => {
        const lineTotal = decimal(item.unitPrice).times(item.quantity);
        subtotal = subtotal.plus(lineTotal);
        return {
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
        };
      });

      const taxRate = decimal(input.taxRate ?? 0.18);
      const discountAmount = Prisma.Decimal.min(subtotal, input.discountAmount ?? 0);
      const taxableSubtotal = Prisma.Decimal.max(0, subtotal.minus(discountAmount));
      const taxAmount = roundMoney(taxableSubtotal.times(taxRate));
      const withholdingAmount = Prisma.Decimal.min(Prisma.Decimal.max(0, subtotal.minus(discountAmount)), input.withholdingAmount ?? 0);
      const serviceCharge = decimal(input.serviceCharge);
      const otherCharges = decimal(input.otherCharges);
      const grossAmount = taxableSubtotal.plus(taxAmount);
      const additionalCharges = serviceCharge.plus(otherCharges);
      const totalAmount = roundMoney(Prisma.Decimal.max(0, grossAmount.plus(additionalCharges).minus(withholdingAmount)));

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          billedTo: input.billedTo,
          ...(input.customerId ? { customerId: input.customerId } : {}),
          invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          taxRate,
          subtotal,
          taxAmount,
          discountAmount,
          withholdingAmount,
          withholdingType: input.withholdingType || null,
          serviceCharge,
          otherCharges,
          totalAmount,
          amountPaid: decimal(0),
          balanceDue: totalAmount,
          status: (input.status as InvoiceStatus) || InvoiceStatus.DRAFT,
          notes: input.notes,
          createdByUserId: currentUserId,
          items: {
            create: itemsWithTotals,
          },
        },
        include: { items: true, customer: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, gstin: true } } },
      });
      await tx.invoiceActivity.create({ data: { invoiceId: invoice.id, userId: currentUserId, type: 'created', message: `Invoice ${invoice.invoiceNumber} created` } });
      if (input.initialPayment) {
        await recordPaymentTx(tx, invoice.id, input.initialPayment, currentUserId, { allowDraft: true });
      }
      return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { items: true, payments: true, activities: { include: { user: { select: { id: true, name: true } } } }, customer: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, gstin: true } }, createdBy: { select: { id: true, name: true, email: true } } } });
    });
  }

  async updateInvoice(id: string, input: UpdateInvoiceInput, currentUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoice" WHERE "id" = ${id} FOR UPDATE`);
      const existing = await tx.invoice.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!existing) throw new NotFoundError('Invoice');
      if (input.initialPayment && existing.payments.length > 0) {
        throw new BadRequestError('An initial payment can only be added before any payments have been recorded');
      }
      if (input.invoiceNumber && input.invoiceNumber !== existing.invoiceNumber) {
        const duplicate = await tx.invoice.findUnique({ where: { invoiceNumber: input.invoiceNumber }, select: { id: true } });
        if (duplicate) throw new BadRequestError('This invoice number is already in use');
      }
      if (decimal(existing.amountPaid).isZero() && input.status && ['PARTIALLY_PAID', 'PAID'].includes(input.status)) {
        throw new BadRequestError('Record a payment before setting a payment status');
      }
      let subtotal = decimal(existing.subtotal);
      let totalAmount = existing.totalAmount;
      const taxRate = input.taxRate !== undefined ? input.taxRate : existing.taxRate;
      const serviceCharge = input.serviceCharge !== undefined ? input.serviceCharge : existing.serviceCharge;
      const otherCharges = input.otherCharges !== undefined ? input.otherCharges : existing.otherCharges;

      // If items are updated, recalculate
      if (input.items && input.items.length > 0) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        subtotal = decimal(0);
        const newItems = input.items.map((item) => {
          const lineTotal = decimal(item.unitPrice).times(item.quantity);
          subtotal = subtotal.plus(lineTotal);
          return {
            invoiceId: id,
            itemDescription: item.itemDescription,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal,
          };
        });

        await tx.invoiceItem.createMany({ data: newItems });

      }
      // A tax-rate-only edit must recalculate amounts even when items are unchanged.
      const discountAmount = Prisma.Decimal.min(subtotal, input.discountAmount ?? existing.discountAmount);
      const taxableSubtotal = Prisma.Decimal.max(0, subtotal.minus(discountAmount));
      const taxAmount = roundMoney(taxableSubtotal.times(taxRate));
      const withholdingAmount = Prisma.Decimal.min(
        Prisma.Decimal.max(0, subtotal.minus(discountAmount)),
        input.withholdingAmount ?? existing.withholdingAmount
      );
      const grossAmount = taxableSubtotal.plus(taxAmount);
      const additionalCharges = decimal(serviceCharge).plus(otherCharges);
      totalAmount = roundMoney(Prisma.Decimal.max(0, grossAmount.plus(additionalCharges).minus(withholdingAmount)));
      if (totalAmount.lessThan(existing.amountPaid)) throw new BadRequestError('Invoice total cannot be reduced below the amount already paid');
      const balanceDue = roundMoney(totalAmount.minus(existing.amountPaid));

      await tx.invoice.update({
        where: { id },
        data: {
          invoiceNumber: input.invoiceNumber,
          customerId: input.customerId === undefined ? undefined : input.customerId,
          billedTo: input.billedTo ?? existing.billedTo,
          invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : undefined,
          dueDate: input.dueDate === undefined ? undefined : input.dueDate === null ? null : new Date(input.dueDate),
          taxRate,
          subtotal,
          taxAmount,
          discountAmount,
          withholdingAmount,
          withholdingType: input.withholdingType === undefined ? undefined : input.withholdingType,
          serviceCharge,
          otherCharges,
          totalAmount,
          balanceDue,
          status: decimal(existing.amountPaid).greaterThan(0)
            ? balanceDue.isZero() ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID
            : (input.status ?? existing.status) as InvoiceStatus,
          notes: input.notes,
        },
        include: {
          items: true,
          customer: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, gstin: true } },
        },
      });
      if (input.initialPayment) {
        await recordPaymentTx(tx, id, input.initialPayment, currentUserId, { allowDraft: true });
      }
      return tx.invoice.findUniqueOrThrow({
        where: { id },
        include: {
          items: true,
          payments: { orderBy: { paymentDate: 'asc' } },
          activities: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true } } } },
          customer: { select: { id: true, name: true, email: true, phone: true, address: true, state: true, gstin: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async addItem(invoiceId: string, input: import('./invoice.schema.js').InvoiceItemInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoice" WHERE "id" = ${invoiceId} FOR UPDATE`);
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw new NotFoundError('Invoice');
      const lineTotal = decimal(input.unitPrice).times(input.quantity);
      await tx.invoiceItem.create({ data: { invoiceId, ...input, lineTotal } });
      return this.recalculateInvoice(tx, invoiceId, userId, `Item added: ${input.itemDescription}`);
    });
  }

  async updateItem(itemId: string, input: Partial<import('./invoice.schema.js').InvoiceItemInput>, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.invoiceItem.findUnique({ where: { id: itemId } });
      if (!current) throw new NotFoundError('Invoice item');
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoice" WHERE "id" = ${current.invoiceId} FOR UPDATE`);
      const changed = { ...current, ...input };
      await tx.invoiceItem.update({ where: { id: itemId }, data: { ...input, lineTotal: decimal(changed.unitPrice).times(changed.quantity) } });
      return this.recalculateInvoice(tx, current.invoiceId, userId, `Item updated: ${changed.itemDescription}`);
    });
  }

  async deleteItem(itemId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.invoiceItem.findUnique({ where: { id: itemId } });
      if (!item) throw new NotFoundError('Invoice item');
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "invoice" WHERE "id" = ${item.invoiceId} FOR UPDATE`);
      await tx.invoiceItem.delete({ where: { id: itemId } });
      return this.recalculateInvoice(tx, item.invoiceId, userId, `Item removed: ${item.itemDescription}`);
    });
  }

  private async recalculateInvoice(tx: Prisma.TransactionClient, invoiceId: string, userId: string, message: string) {
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const items = await tx.invoiceItem.findMany({ where: { invoiceId } });
    const subtotal = items.reduce((sum, item) => sum.plus(item.lineTotal), decimal(0));
    const taxableSubtotal = Prisma.Decimal.max(0, subtotal.minus(invoice.discountAmount));
    const taxAmount = roundMoney(taxableSubtotal.times(invoice.taxRate));
    const grossAmount = taxableSubtotal.plus(taxAmount);
    const additionalCharges = decimal(invoice.serviceCharge).plus(invoice.otherCharges);
    const totalAmount = roundMoney(Prisma.Decimal.max(0, grossAmount.plus(additionalCharges).minus(invoice.withholdingAmount)));
    if (totalAmount.lessThan(invoice.amountPaid)) throw new BadRequestError('Invoice total cannot be reduced below the amount already paid');
    const balanceDue = roundMoney(totalAmount.minus(invoice.amountPaid));
    const status = decimal(invoice.amountPaid).greaterThan(0) ? balanceDue.isZero() ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID : invoice.status;
    await tx.invoice.update({ where: { id: invoiceId }, data: { subtotal, taxAmount, totalAmount, balanceDue, status } });
    await tx.invoiceActivity.create({ data: { invoiceId, userId, type: 'invoice_updated', message } });
    return tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
  }

  async deleteInvoice(id: string) {
    await this.getInvoiceById(id);
    return this.prisma.invoice.delete({ where: { id } });
  }

  async generatePDF(id: string) {
    const invoice = await this.getInvoiceById(id);
    return PDFService.generateInvoicePDF(invoice);
  }
}
