import type { Prisma } from '@prisma/client';
import { decimal } from '../../shared/utils/money.js';
import { formatCurrency } from '../../utils/format.js';

export interface InvoiceWithItems {
  id: string;
  invoiceNumber: string;
  billedTo: string;
  invoiceDate: Date | string;
  dueDate: Date | string | null;
  subtotal: Prisma.Decimal.Value;
  taxRate: Prisma.Decimal.Value;
  taxAmount: Prisma.Decimal.Value;
  serviceCharge: Prisma.Decimal.Value;
  otherCharges: Prisma.Decimal.Value;
  totalAmount: Prisma.Decimal.Value;
  status: string;
  notes?: string | null;
  items: Array<{
    id?: string;
    itemDescription: string;
    quantity: number;
    unitPrice: Prisma.Decimal.Value;
    lineTotal: Prisma.Decimal.Value;
  }>;
}

export interface TemplateInputs {
  billedToInput: string;
  info: string;
  orders: string[][];
  taxInput: string;
  date: string;
  subtotal: Prisma.Decimal.Value;
  tax: Prisma.Decimal.Value;
  total: Prisma.Decimal.Value;
  subtotalFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
  serviceChargeFormatted: string;
  otherChargesFormatted: string;
}

export class InvoiceTemplateMapper {
  static mapToTemplateInputs(invoice: InvoiceWithItems): TemplateInputs {
    const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const dueDate = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : invoiceDate;

    const orderItems = invoice.items.map((item) => [
      item.itemDescription,
      item.quantity.toString(),
      formatCurrency(item.unitPrice),
      formatCurrency(item.lineTotal),
    ]);

    return {
      billedToInput: invoice.billedTo,
      info: JSON.stringify({
        InvoiceNo: invoice.invoiceNumber,
        Date: invoiceDate,
      }),
      orders: orderItems,
      taxInput: JSON.stringify({
        rate: (decimal(invoice.taxRate).times(100)).toString(),
      }),
      date: dueDate,
      subtotal: invoice.subtotal,
      tax: invoice.taxAmount,
      total: invoice.totalAmount,
      subtotalFormatted: formatCurrency(invoice.subtotal),
      taxFormatted: formatCurrency(invoice.taxAmount),
      totalFormatted: formatCurrency(invoice.totalAmount),
      serviceChargeFormatted: formatCurrency(invoice.serviceCharge),
      otherChargesFormatted: formatCurrency(invoice.otherCharges),
    };
  }

  static validateInvoiceData(invoice: InvoiceWithItems): boolean {
    if (!invoice.invoiceNumber) throw new Error('Invoice number is required');
    if (!invoice.billedTo || invoice.billedTo.trim() === '') throw new Error('Billed to information is required');
    if (!invoice.invoiceDate) throw new Error('Invoice date is required');
    if (!invoice.items || invoice.items.length === 0) throw new Error('At least one invoice item is required');

    invoice.items.forEach((item, index) => {
      if (!item.itemDescription || item.itemDescription.trim() === '') throw new Error(`Item ${index + 1}: Description is required`);
      if (item.quantity <= 0) throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
      if (decimal(item.unitPrice).lessThan(0)) throw new Error(`Item ${index + 1}: Unit price cannot be negative`);
    });

    return true;
  }
}
