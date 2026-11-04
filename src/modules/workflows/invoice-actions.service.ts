import { taxRateSchema, moneySchema } from '../../shared/utils/money.schemas.js';
import { decimal, roundMoney } from '../../shared/utils/money.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { z } from 'zod';
import { InvoiceStatus } from './support/types/invoice.js';
import { Prisma } from '@prisma/client';
import { invalidateDashboardCache } from './support/lib/cache/cache-invalidation.js';
import { normalizePagination, validateSortField, validateSortOrder, buildPaginationResult, } from './support/lib/pagination-utils.js';
export function createInvoiceActionsService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const workflowSession = { user: currentUser, session: { id: currentUser.id, userId: currentUser.id } };
    async function getCurrentUser() {
        const session = workflowSession;
        if (!session) {
            throw new Error('Unauthorized');
        }
        return session.user;
    }
    function generateInvoiceNumber(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 9999)
            .toString()
            .padStart(4, '0');
        return `INV-${year}${month}${day}-${random}`;
    }
    function calculateTotals(items: Array<{
        quantity: number;
        unitPrice: Prisma.Decimal.Value;
    }>, taxRate: Prisma.Decimal.Value, serviceCharge: Prisma.Decimal.Value = 0, otherCharges: Prisma.Decimal.Value = 0, taxRounding: string = 'exact') {
        const subtotal = items.reduce((sum, item) => sum.plus(decimal(item.unitPrice).times(item.quantity)), decimal(0));
        const taxableAmount = subtotal.plus(serviceCharge).plus(otherCharges);
        let taxAmount = taxableAmount.times(taxRate);
        if (taxRounding === 'round_off') {
            const itemTax = items.reduce((sum, item) => {
                const lineTax = decimal(item.unitPrice).times(item.quantity).times(taxRate);
                return sum.plus(roundMoney(lineTax));
            }, decimal(0));
            taxAmount = itemTax.plus(roundMoney(decimal(serviceCharge).times(taxRate))).plus(roundMoney(decimal(otherCharges).times(taxRate)));
        }
        return {
            subtotal: roundMoney(subtotal),
            taxAmount: roundMoney(taxAmount),
            totalAmount: roundMoney(taxableAmount.plus(taxAmount)),
        };
    }
    const createInvoiceSchema = z.object({
        billedTo: z.string().min(1, 'Billed to is required'),
        invoiceDate: z.coerce.date().optional(),
        dueDate: z.coerce.date().optional(),
        notes: z.string().optional(),
        taxRate: taxRateSchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").refine((value) => value.lessThanOrEqualTo(1), "Amount exceeds the maximum"),
        taxRounding: z.string().optional(),
        serviceCharge: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").optional(),
        otherCharges: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").optional(),
    });
    const updateInvoiceSchema = z.object({
        id: z.string().min(1, 'Invoice ID is required'),
        billedTo: z.string().optional(),
        invoiceDate: z.coerce.date().optional(),
        dueDate: z.coerce.date().optional(),
        notes: z.string().optional(),
        taxRate: taxRateSchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").refine((value) => value.lessThanOrEqualTo(1), "Amount exceeds the maximum").optional(),
        taxRounding: z.string().optional(),
        serviceCharge: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").optional(),
        otherCharges: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").optional(),
        status: z.nativeEnum(InvoiceStatus).optional(),
    });
    const deleteInvoiceSchema = z.object({
        id: z.string().min(1, 'Invoice ID is required'),
    });
    const createInvoiceItemSchema = z.object({
        invoiceId: z.string().min(1, 'Invoice ID is required'),
        itemDescription: z.string().min(1, 'Item description is required'),
        quantity: z.number().min(1, 'Quantity must be at least 1'),
        unitPrice: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Unit price must be positive'),
    });
    const updateInvoiceItemSchema = z.object({
        id: z.string().min(1, 'Invoice item ID is required'),
        itemDescription: z.string().optional(),
        quantity: z.number().min(1).optional(),
        unitPrice: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), "Amount is below the minimum").optional(),
    });
    const deleteInvoiceItemSchema = z.object({
        id: z.string().min(1, 'Invoice item ID is required'),
    });
    const getInvoicesSchema = z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
        search: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        status: z.nativeEnum(InvoiceStatus).optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
    });
    const getInvoiceByIdSchema = z.object({
        id: z.string().min(1, 'Invoice ID is required'),
    });
    async function createInvoice(input: unknown) {
        const parsedInput = createInvoiceSchema.parse(input ?? {});
        try {
            const user = await getCurrentUser();
            // Generate unique invoice number
            let invoiceNumber: string;
            let attempts = 0;
            const maxAttempts = 10;
            do {
                invoiceNumber = generateInvoiceNumber();
                const existing = await prisma.invoice.findUnique({ where: { invoiceNumber } });
                if (!existing)
                    break;
                attempts++;
            } while (attempts < maxAttempts);
            if (attempts >= maxAttempts) {
                throw new Error('Could not generate unique invoice number');
            }
            const invoice = await prisma.invoice.create({
                data: {
                    invoiceNumber,
                    billedTo: parsedInput.billedTo,
                    invoiceDate: parsedInput.invoiceDate || new Date(),
                    dueDate: parsedInput.dueDate,
                    notes: parsedInput.notes,
                    taxRate: parsedInput.taxRate,
                    serviceCharge: parsedInput.serviceCharge || 0,
                    otherCharges: parsedInput.otherCharges || 0,
                    subtotal: decimal(0),
                    taxAmount: decimal(0),
                    totalAmount: decimal(0),
                    status: InvoiceStatus.DRAFT,
                    createdBy: { connect: { id: user.id } },
                },
                include: {
                    items: true,
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            await invalidateDashboardCache();
            return { success: true, data: invoice, message: 'Invoice created successfully' };
        }
        catch (error) {
            console.error('Error creating invoice:', error);
            throw new Error('Failed to create invoice');
        }
    }
    async function updateInvoice(input: unknown) {
        const parsedInput = updateInvoiceSchema.parse(input ?? {});
        try {
            const { id, ...updateData } = parsedInput;
            // Check if invoice exists and user has permission
            const existingInvoice = await prisma.invoice.findUnique({
                where: { id },
                include: { items: true },
            });
            if (!existingInvoice) {
                throw new Error('Invoice not found');
            }
            // Build update data
            const data: Record<string, unknown> = {};
            if (updateData.billedTo)
                data.billedTo = updateData.billedTo;
            if (updateData.invoiceDate)
                data.invoiceDate = updateData.invoiceDate;
            if (updateData.dueDate !== undefined)
                data.dueDate = updateData.dueDate;
            if (updateData.notes !== undefined)
                data.notes = updateData.notes;
            if (updateData.status)
                data.status = updateData.status;
            // If tax rate, service charge, or other charges are updated, recalculate totals
            if (updateData.taxRate !== undefined || updateData.serviceCharge !== undefined || updateData.otherCharges !== undefined) {
                data.taxRate = updateData.taxRate ?? existingInvoice.taxRate;
                data.serviceCharge = updateData.serviceCharge ?? existingInvoice.serviceCharge;
                data.otherCharges = updateData.otherCharges ?? existingInvoice.otherCharges;
                const totals = calculateTotals(existingInvoice.items, data.taxRate as Prisma.Decimal.Value, data.serviceCharge as Prisma.Decimal.Value, data.otherCharges as Prisma.Decimal.Value, 'exact');
                data.subtotal = totals.subtotal;
                data.taxAmount = totals.taxAmount;
                data.totalAmount = totals.totalAmount;
            }
            const invoice = await prisma.invoice.update({
                where: { id },
                data,
                include: {
                    items: true,
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            await invalidateDashboardCache();
            return { success: true, data: invoice, message: 'Invoice updated successfully' };
        }
        catch (error) {
            console.error('Error updating invoice:', error);
            throw new Error('Failed to update invoice');
        }
    }
    async function deleteInvoice(input: unknown) {
        const parsedInput = deleteInvoiceSchema.parse(input ?? {});
        try {
            // Check if invoice exists
            const existingInvoice = await prisma.invoice.findUnique({
                where: { id: parsedInput.id },
            });
            if (!existingInvoice) {
                throw new Error('Invoice not found');
            }
            // Delete all invoice items first, then the invoice
            await prisma.invoiceItem.deleteMany({
                where: { invoiceId: parsedInput.id },
            });
            await prisma.invoice.delete({
                where: { id: parsedInput.id },
            });
            await invalidateDashboardCache();
            return { success: true, message: 'Invoice deleted successfully' };
        }
        catch (error) {
            console.error('Error deleting invoice:', error);
            throw new Error('Failed to delete invoice');
        }
    }
    const INVOICE_SORT_FIELDS = [
        'createdAt',
        'invoiceDate',
        'invoiceNumber',
        'billedTo',
        'totalAmount',
        'status',
        'dueDate',
        'updatedAt',
    ];
    async function getInvoices(input: unknown) {
        const parsedInput = getInvoicesSchema.parse(input ?? {});
        try {
            const { page, limit, skip } = normalizePagination({
                page: parsedInput.page,
                limit: parsedInput.limit,
            });
            const sortBy = validateSortField(parsedInput.sortBy, INVOICE_SORT_FIELDS, 'createdAt');
            const sortOrder = validateSortOrder(parsedInput.sortOrder, 'desc');
            // Build where clause
            const where: Prisma.InvoiceWhereInput = {};
            const user = await getCurrentUser();
            const role = (user.role || '').toLowerCase();
            if (role === 'telecaller') {
                where.createdByUserId = user.id;
            }
            else if ((role === 'manager' || role === 'executive' || role === 'branch manager') && user.branch) {
                where.createdBy = {
                    branch: user.branch,
                };
            }
            if (parsedInput.search && parsedInput.search.trim()) {
                const query = parsedInput.search.trim();
                where.OR = [
                    { invoiceNumber: { contains: query, mode: 'insensitive' } },
                    { billedTo: { contains: query, mode: 'insensitive' } },
                ];
            }
            if (parsedInput.status) {
                where.status = parsedInput.status as any;
            }
            if (parsedInput.dateFrom || parsedInput.dateTo) {
                where.invoiceDate = {};
                if (parsedInput.dateFrom)
                    where.invoiceDate.gte = parsedInput.dateFrom;
                if (parsedInput.dateTo)
                    where.invoiceDate.lte = parsedInput.dateTo;
            }
            const [invoices, total] = await Promise.all([
                prisma.invoice.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    select: {
                        id: true,
                        invoiceNumber: true,
                        billedTo: true,
                        invoiceDate: true,
                        dueDate: true,
                        subtotal: true,
                        taxRate: true,
                        taxAmount: true,
                        serviceCharge: true,
                        otherCharges: true,
                        totalAmount: true,
                        status: true,
                        notes: true,
                        createdAt: true,
                        updatedAt: true,
                        createdBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                }),
                prisma.invoice.count({ where }),
            ]);
            const pagination = buildPaginationResult(total, page, limit);
            return {
                success: true,
                data: invoices,
                total,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total: pagination.total,
                    totalPages: pagination.totalPages,
                },
                message: 'Invoices fetched successfully',
            };
        }
        catch (error) {
            console.error('Error fetching invoices:', error);
            throw new Error('Failed to fetch invoices');
        }
    }
    async function getInvoiceById(input: unknown) {
        const parsedInput = getInvoiceByIdSchema.parse(input ?? {});
        try {
            const invoice = await prisma.invoice.findUnique({
                where: { id: parsedInput.id },
                include: {
                    items: {
                        orderBy: { createdAt: 'asc' },
                    },
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            if (!invoice) {
                throw new Error('Invoice not found');
            }
            return { success: true, data: invoice, message: 'Invoice fetched successfully' };
        }
        catch (error) {
            console.error('Error fetching invoice:', error);
            throw new Error('Failed to fetch invoice');
        }
    }
    const addInvoiceItemSchema = createInvoiceItemSchema;
    async function addInvoiceItem(input: unknown) {
        const parsedInput = addInvoiceItemSchema.parse(input ?? {});
        try {
            const lineTotal = decimal(parsedInput.quantity).times(parsedInput.unitPrice);
            const invoiceItem = await prisma.invoiceItem.create({
                data: {
                    itemDescription: parsedInput.itemDescription,
                    quantity: parsedInput.quantity,
                    unitPrice: parsedInput.unitPrice,
                    lineTotal: roundMoney(lineTotal),
                    invoice: { connect: { id: parsedInput.invoiceId } },
                },
            });
            // Recalculate invoice totals
            await recalculateInvoiceTotals(parsedInput.invoiceId);
            return { success: true, data: invoiceItem, message: 'Invoice item added successfully' };
        }
        catch (error) {
            console.error('Error adding invoice item:', error);
            throw new Error('Failed to add invoice item');
        }
    }
    async function updateInvoiceItem(input: unknown) {
        const parsedInput = updateInvoiceItemSchema.parse(input ?? {});
        try {
            const { id, ...updateData } = parsedInput;
            // Get current item to calculate new line total
            const currentItem = await prisma.invoiceItem.findUnique({
                where: { id },
            });
            if (!currentItem) {
                throw new Error('Invoice item not found');
            }
            const quantity = updateData.quantity ?? currentItem.quantity;
            const unitPrice = updateData.unitPrice ?? currentItem.unitPrice;
            const lineTotal = roundMoney(decimal(unitPrice).times(quantity));
            const invoiceItem = await prisma.invoiceItem.update({
                where: { id },
                data: {
                    ...updateData,
                    lineTotal,
                },
            });
            // Recalculate invoice totals
            await recalculateInvoiceTotals(currentItem.invoiceId);
            return { success: true, data: invoiceItem, message: 'Invoice item updated successfully' };
        }
        catch (error) {
            console.error('Error updating invoice item:', error);
            throw new Error('Failed to update invoice item');
        }
    }
    async function deleteInvoiceItem(input: unknown) {
        const parsedInput = deleteInvoiceItemSchema.parse(input ?? {});
        try {
            const item = await prisma.invoiceItem.findUnique({
                where: { id: parsedInput.id },
            });
            if (!item) {
                throw new Error('Invoice item not found');
            }
            await prisma.invoiceItem.delete({
                where: { id: parsedInput.id },
            });
            // Recalculate invoice totals
            await recalculateInvoiceTotals(item.invoiceId);
            return { success: true, message: 'Invoice item deleted successfully' };
        }
        catch (error) {
            console.error('Error deleting invoice item:', error);
            throw new Error('Failed to delete invoice item');
        }
    }
    async function recalculateInvoiceTotals(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { items: true },
        });
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        const totals = calculateTotals(invoice.items, invoice.taxRate, invoice.serviceCharge, invoice.otherCharges, 'exact');
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                subtotal: totals.subtotal,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
            },
        });
    }
    const calculateInvoiceTotalsSchema = getInvoiceByIdSchema;
    async function calculateInvoiceTotals(input: unknown) {
        const parsedInput = calculateInvoiceTotalsSchema.parse(input ?? {});
        try {
            await recalculateInvoiceTotals(parsedInput.id);
            return { success: true, message: 'Invoice totals recalculated successfully' };
        }
        catch (error) {
            console.error('Error recalculating invoice totals:', error);
            throw new Error('Failed to recalculate invoice totals');
        }
    }
    return { createInvoice, updateInvoice, deleteInvoice, getInvoices, getInvoiceById, addInvoiceItem, updateInvoiceItem, deleteInvoiceItem, calculateInvoiceTotals };
}
