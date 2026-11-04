import type { Prisma } from '@prisma/client';
// Invoice Status enum (matching Prisma schema exactly)
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

// Base interfaces
export interface Invoice {
  id: string;
  invoiceNumber: string;
  billedTo: string;
  invoiceDate: Date;
  dueDate: Date | null;
  subtotal: Prisma.Decimal.Value;
  taxRate: Prisma.Decimal.Value;
  taxRounding: string;
  taxAmount: Prisma.Decimal.Value;
  serviceCharge: Prisma.Decimal.Value;
  otherCharges: Prisma.Decimal.Value;
  totalAmount: Prisma.Decimal.Value;
  amountPaid?: Prisma.Decimal.Value;
  balanceDue?: Prisma.Decimal.Value;
  status: InvoiceStatus;
  notes: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  itemDescription: string;
  quantity: number;
  unitPrice: Prisma.Decimal.Value;
  lineTotal: Prisma.Decimal.Value;
  invoiceId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extended interfaces with relations
export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  customer?: { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; state?: string | null; gstin?: string | null } | null;
  payments?: Array<{ id: string; paymentNumber: string; paymentDate: Date | string; amount: Prisma.Decimal.Value; paymentMode: string; depositTo?: string | null; referenceNumber?: string | null; notes?: string | null }>;
  activities?: Array<{ id: string; type: string; message: string; createdAt: Date | string; user: { id: string; name: string } }>;
  shareToken?: string | null;
  remindersEnabled?: boolean;
  reminderRules?: string[];
}

export interface InvoiceWithRelations extends Invoice {
  items: InvoiceItem[];
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

// Form data types
export interface CreateInvoiceInput {
  billedTo: string;
  invoiceDate?: Date;
  dueDate?: Date | null;
  notes?: string | null;
  taxRate?: Prisma.Decimal.Value;
  taxRounding?: string;
}

export interface UpdateInvoiceInput {
  id: string;
  billedTo?: string;
  invoiceDate?: Date;
  dueDate?: Date | null;
  notes?: string | null;
  taxRate?: Prisma.Decimal.Value;
  status?: InvoiceStatus;
}

export interface InvoiceFormData {
  billedTo: string;
  invoiceDate: Date;
  dueDate?: Date | null;
  notes?: string | null;
  taxRate: Prisma.Decimal.Value;
}

// Invoice item types
export interface CreateInvoiceItemInput {
  invoiceId: string;
  itemDescription: string;
  quantity: number;
  unitPrice: Prisma.Decimal.Value;
}

export interface UpdateInvoiceItemInput {
  id: string;
  itemDescription?: string;
  quantity?: number;
  unitPrice?: Prisma.Decimal.Value;
}

export interface InvoiceItemFormData {
  itemDescription: string;
  quantity: number;
  unitPrice: Prisma.Decimal.Value;
}

// Calculation types
export interface InvoiceTotals {
  subtotal: Prisma.Decimal.Value;
  taxAmount: Prisma.Decimal.Value;
  totalAmount: Prisma.Decimal.Value;
}

// API response types
export interface CreateInvoiceResponse {
  success: boolean;
  data?: Invoice;
  message?: string;
  error?: string;
}

export interface GetInvoicesResponse {
  success: boolean;
  data?: InvoiceWithItems[];
  total?: number;
  message?: string;
  error?: string;
}

export interface GetInvoiceResponse {
  success: boolean;
  data?: InvoiceWithItems;
  message?: string;
  error?: string;
}

// Table column types
export interface InvoiceTableData {
  id: string;
  invoiceNumber: string;
  billedTo: string;
  invoiceDate: Date;
  status: InvoiceStatus;
  totalAmount: Prisma.Decimal.Value;
  createdAt: Date;
}

// Filter and search types
export interface InvoiceFilters {
  status?: InvoiceStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface InvoiceSearchParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filters?: InvoiceFilters;
}

// PDF generation types
export interface InvoicePDFData {
  billedToInput: string;
  info: {
    InvoiceNo: string;
    Date: string;
  };
  orders: string[][];
  taxInput: {
    rate: string;
  };
}

export interface PDFGenerationOptions {
  format?: 'A4' | 'Letter';
  download?: boolean;
  filename?: string;
}
