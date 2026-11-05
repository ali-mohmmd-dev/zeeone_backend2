import { InvoiceService } from '../invoices/invoice.service.js';
import { taxRateSchema, moneySchema } from '../../shared/utils/money.schemas.js';
import { decimal } from '../../shared/utils/money.js';
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
        const { id, taxRounding, ...data } = updateInvoiceSchema.parse(input ?? {});
        const invoice = await new InvoiceService(prisma).updateInvoice(id, data, currentUser.id);
        await invalidateDashboardCache();
        return { success: true, data: invoice, message: 'Invoice updated successfully' };
    }
    async function deleteInvoice(input: unknown) {
        const { id } = deleteInvoiceSchema.parse(input ?? {});
        await new InvoiceService(prisma).deleteInvoice(id, currentUser.id);
        await invalidateDashboardCache();
        return { success: true, message: 'Invoice cancelled successfully' };
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
    async function addInvoiceItem(input: unknown) {
        const { invoiceId, ...data } = createInvoiceItemSchema.parse(input ?? {});
        const invoice = await new InvoiceService(prisma).addItem(invoiceId, data, currentUser.id);
        await invalidateDashboardCache();
        return { success: true, data: invoice.addedItem, message: 'Invoice item added successfully' };
    }
    async function updateInvoiceItem(input: unknown) {
        const { id, ...data } = updateInvoiceItemSchema.parse(input ?? {});
        const invoice = await new InvoiceService(prisma).updateItem(id, data, currentUser.id);
        await invalidateDashboardCache();
        return { success: true, data: invoice.items.find(item => item.id === id), message: 'Invoice item updated successfully' };
    }
    async function deleteInvoiceItem(input: unknown) {
        const { id } = deleteInvoiceItemSchema.parse(input ?? {});
        await new InvoiceService(prisma).deleteItem(id, currentUser.id);
        await invalidateDashboardCache();
        return { success: true, message: 'Invoice item deleted successfully' };
    }
    async function calculateInvoiceTotals(input: unknown) {
        const { id } = getInvoiceByIdSchema.parse(input ?? {});
        await new InvoiceService(prisma).recalculateTotals(id, currentUser.id);
        await invalidateDashboardCache();
        return { success: true, message: 'Invoice totals recalculated successfully' };
    }
    return { createInvoice, updateInvoice, deleteInvoice, getInvoices, getInvoiceById, addInvoiceItem, updateInvoiceItem, deleteInvoiceItem, calculateInvoiceTotals };
}
