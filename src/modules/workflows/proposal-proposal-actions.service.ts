import { AppError } from '../../errors/app-error.js';
import { moneySchema, taxRateSchema } from '../../shared/utils/money.schemas.js';
import { decimal, moneyMax } from '../../shared/utils/money.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { z } from 'zod';
import { ProposalStatus } from './support/types/proposal.js';
import { createAdmissionActionsService } from './admission-actions.service.js';
export function createProposalProposalActionsService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const getCurrentUser = createAdmissionActionsService(prisma, currentUser).getCurrentUser;
    const proposalItemSchema = z.object({
        id: z.string().optional(),
        description: z.string().min(1, 'Item description is required'),
        quantity: z.number().min(1, 'Quantity must be at least 1'),
        unitPrice: moneySchema.refine((value) => value.greaterThanOrEqualTo(0), 'Unit price cannot be negative'),
        panelBrand: z.string().optional().nullable(),
        systemPrice: moneySchema.optional(),
        ksebFee: moneySchema.optional(),
        afterSubsidy: moneySchema.optional().nullable(),
        itemTaxRate: taxRateSchema.default(0),
    });
    const createProposalSchema = z.object({
        title: z.string().optional(),
        clientName: z.string().min(1, 'Client Name is required'),
        clientEmail: z.string().email().optional().or(z.literal('')),
        clientPhone: z.string().optional().or(z.literal('')),
        clientAddress: z.string().optional().or(z.literal('')),
        branch: z.string().optional().or(z.literal('')),
        branchId: z.string().optional().or(z.literal('')),
        enquiryId: z.string().optional().or(z.literal('')),
        status: z.nativeEnum(ProposalStatus).default(ProposalStatus.DRAFT),
        validUntil: z.string().optional().or(z.literal('')),
        taxRate: taxRateSchema.default(0),
        discountAmount: moneySchema.default(0),
        notes: z.string().optional().or(z.literal('')),
        terms: z.string().optional().or(z.literal('')),
        items: z.array(proposalItemSchema).min(1, 'At least one item is required'),
    });
    const updateProposalSchema = z.object({
        id: z.string().min(1, 'Proposal ID is required'),
        title: z.string().optional(),
        clientName: z.string().min(1).optional(),
        clientEmail: z.string().email().optional().or(z.literal('')),
        clientPhone: z.string().optional().or(z.literal('')),
        clientAddress: z.string().optional().or(z.literal('')),
        branch: z.string().optional().or(z.literal('')),
        branchId: z.string().optional().or(z.literal('')),
        enquiryId: z.string().optional().or(z.literal('')),
        status: z.nativeEnum(ProposalStatus).optional(),
        validUntil: z.string().optional().or(z.literal('')),
        taxRate: taxRateSchema.optional(),
        discountAmount: moneySchema.optional(),
        notes: z.string().optional().or(z.literal('')),
        terms: z.string().optional().or(z.literal('')),
        items: z.array(proposalItemSchema).optional(),
    });
    async function generateProposalNumber(): Promise<string> {
        const prefix = `PROP-${new Date().getFullYear()}-`;
        const count = await prisma.proposal.count({
            where: { proposalNo: { startsWith: prefix } },
        });
        return `${prefix}${String(count + 1).padStart(4, '0')}`;
    }
    const getProposalsSchema = z.object({}).optional();
    async function getProposals(input: unknown = undefined) {
        getProposalsSchema.parse(input ?? {});
        try {
            let currentUser: any = null;
            try {
                currentUser = await getCurrentUser();
            }
            catch {
                // User might be public/unauth in some contexts
            }
            const role = currentUser?.role;
            const branch = currentUser?.branch;
            // Use Prisma ORM delegate if compiled, or direct parameterized query
            let proposals: any[] = [];
            {
                const whereClause: any = {};
                if (role && role !== 'admin' && branch) {
                    whereClause.OR = [{ branch: branch }, { branchId: branch }];
                }
                proposals = await prisma.proposal.findMany({
                    where: whereClause,
                    include: {
                        items: true,
                        enquiry: {
                            select: {
                                id: true,
                                candidateName: true,
                                phone: true,
                                email: true,
                                preferredCourse: {
                                    select: { id: true, name: true, courseFee: true },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                });
            }
            return { success: true, data: proposals };
        }
        catch (error) {
            console.error('Error fetching proposals:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch proposals',
                data: [],
            };
        }
    }
    const getProposalByIdSchema = z.object({ id: z.string().min(1) });
    async function getProposalById(input: unknown) {
        const { id } = getProposalByIdSchema.parse(input ?? {});
        try {
            let proposal: any = null;
            {
                proposal = await prisma.proposal.findUnique({
                    where: { id },
                    include: {
                        items: true,
                        enquiry: {
                            select: {
                                id: true,
                                candidateName: true,
                                phone: true,
                                email: true,
                                preferredCourse: {
                                    select: { id: true, name: true, courseFee: true },
                                },
                            },
                        },
                        createdBy: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                });
            }
            if (!proposal) {
                return { success: false, message: 'Proposal not found' };
            }
            return { success: true, data: proposal };
        }
        catch (error) {
            console.error('Error fetching proposal by ID:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to fetch proposal',
            };
        }
    }
    async function createProposal(input: unknown, logStep?: (step: string, fields?: Record<string, unknown>) => void) {
        logStep?.('input_validation_started');
        const parsedInput = createProposalSchema.parse(input ?? {});
        logStep?.('input_validation_succeeded', { itemCount: parsedInput.items.length, hasEnquiry: Boolean(parsedInput.enquiryId) });
        try {
            let currentUser: any = null;
            try {
                currentUser = await getCurrentUser();
            }
            catch {
                // Fallback for unauthenticated or system context
            }
            logStep?.('current_user_resolved', { userId: currentUser?.id });
            logStep?.('proposal_number_generation_started');
            const proposalNo = await generateProposalNumber();
            logStep?.('proposal_number_generated', { proposalNo });
            // Resolve branch: prioritize passed branch, then currentUser branch, then fallback
            const effectiveBranch = parsedInput.branch && parsedInput.branch.trim() !== ''
                ? parsedInput.branch.trim()
                : currentUser?.branch || 'Main Branch';
            const effectiveBranchId = parsedInput.branchId && parsedInput.branchId.trim() !== ''
                ? parsedInput.branchId.trim()
                : effectiveBranch;
            // Calculate items and totals
            const processedItems = parsedInput.items.map((item) => {
                const qty = Number(item.quantity) || 1;
                const price = decimal(item.unitPrice);
                const itemTaxRate = decimal(item.itemTaxRate || 0);
                const baseTotal = decimal(qty).times(price);
                const itemTaxAmount = baseTotal.times(itemTaxRate).div(100);
                return {
                    description: item.description.trim(),
                    quantity: qty,
                    unitPrice: price,
                    panelBrand: item.panelBrand || null,
                    systemPrice: item.systemPrice ?? null,
                    ksebFee: item.ksebFee ?? null,
                    afterSubsidy: item.afterSubsidy ?? null,
                    itemTaxRate,
                    total: baseTotal.plus(itemTaxAmount),
                };
            });
            const subtotal = processedItems.reduce((acc, curr) => decimal(acc).plus(curr.total), decimal(0));
            const taxRate = decimal(parsedInput.taxRate);
            const taxAmount = decimal(subtotal).times(taxRate).div(100);
            const discountAmount = decimal(parsedInput.discountAmount);
            const totalAmount = moneyMax(0, decimal(subtotal).plus(taxAmount).minus(discountAmount));
            const validUntilDate = parsedInput.validUntil
                ? new Date(parsedInput.validUntil)
                : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days default validity
            const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            let savedProposal: any = null;
            {
                logStep?.('database_insert_started', { itemCount: processedItems.length });
                savedProposal = await prisma.proposal.create({
                    data: {
                        id: proposalId,
                        proposalNo,
                        title: parsedInput.title || `Quotation for ${parsedInput.clientName}`,
                        clientName: parsedInput.clientName.trim(),
                        clientEmail: parsedInput.clientEmail?.trim() || null,
                        clientPhone: parsedInput.clientPhone?.trim() || null,
                        clientAddress: parsedInput.clientAddress?.trim() || null,
                        branch: effectiveBranch,
                        branchId: effectiveBranchId,
                        enquiryId: parsedInput.enquiryId?.trim() || null,
                        status: parsedInput.status || ProposalStatus.DRAFT,
                        validUntil: validUntilDate,
                        subtotal,
                        taxRate,
                        taxAmount,
                        discountAmount,
                        totalAmount,
                        notes: parsedInput.notes || null,
                        terms: parsedInput.terms ||
                            '1. Proposal is valid for 15 days from issue date.\n2. Payment: 50% advance, 50% upon delivery/completion.\n3. Net metering and solar grid synchronization subject to KSEB approval.',
                        createdById: currentUser?.id || null,
                        createdByUser: currentUser?.name || 'CRM Team',
                        items: {
                            create: processedItems.map((item) => ({
                                id: `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                total: item.total,
                                panelBrand: item.panelBrand,
                                systemPrice: item.systemPrice,
                                ksebFee: item.ksebFee,
                                afterSubsidy: item.afterSubsidy,
                                itemTaxRate: item.itemTaxRate,
                            })),
                        },
                    },
                    include: {
                        items: true,
                    },
                });
            }
            logStep?.('database_insert_succeeded', { recordId: savedProposal.id, proposalNo });
            // If created from an enquiry, optionally update enquiry lastContactDate
            if (parsedInput.enquiryId) {
                try {
                    logStep?.('enquiry_update_started');
                    await prisma.enquiry.update({
                        where: { id: parsedInput.enquiryId },
                        data: {
                            lastContactDate: new Date(),
                            notes: {
                                set: `Proposal #${proposalNo} (Amount: ₹${totalAmount.toFixed(2)}) created.`,
                            },
                        },
                    });
                    logStep?.('enquiry_update_succeeded');
                }
                catch (e) {
                    logStep?.('enquiry_update_failed', { error: e instanceof Error ? e.message : String(e) });
                    console.warn('Could not update enquiry contact date:', e);
                }
            }
            return {
                success: true,
                data: savedProposal,
                message: `Proposal ${proposalNo} created successfully!`,
            };
        }
        catch (error) {
            logStep?.('failed', { error: error instanceof Error ? error.message : String(error), code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
            console.error('Error creating proposal:', error);
            if (error instanceof Error && 'code' in error && error.code === 'P2021') {
                throw new AppError('Proposal tables are missing. Apply the proposal-table database repair.', 503, 'DATABASE_SCHEMA_MISSING');
            }
            throw error;
        }
    }
    async function updateProposal(input: unknown) {
        const parsedInput = updateProposalSchema.parse(input ?? {});
        try {
            const { id, items, ...updateFields } = parsedInput;
            // Check existence
            let existing: any = null;
            {
                existing = await prisma.proposal.findUnique({
                    where: { id },
                    include: { items: true },
                });
            }
            if (!existing) {
                return { success: false, message: 'Proposal not found' };
            }
            let subtotal = decimal(existing.subtotal);
            let totalAmount = decimal(existing.totalAmount);
            let taxRate = updateFields.taxRate !== undefined ? updateFields.taxRate : existing.taxRate || 0;
            let discountAmount = updateFields.discountAmount !== undefined
                ? updateFields.discountAmount
                : existing.discountAmount || 0;
            // If items are provided, recalculate totals
            let processedItems: any[] | null = null;
            if (items && items.length > 0) {
                processedItems = items.map((item) => {
                    const qty = Number(item.quantity) || 1;
                    const price = decimal(item.unitPrice);
                    const itemTaxRate = decimal(item.itemTaxRate || 0);
                    const baseTotal = decimal(qty).times(price);
                    return {
                        id: item.id || `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                        description: item.description.trim(),
                        quantity: qty,
                        unitPrice: price,
                        panelBrand: item.panelBrand || null,
                        systemPrice: item.systemPrice ?? null,
                        ksebFee: item.ksebFee ?? null,
                        afterSubsidy: item.afterSubsidy ?? null,
                        itemTaxRate,
                        total: baseTotal.plus(baseTotal.times(itemTaxRate).div(100)),
                    };
                });
                subtotal = processedItems.reduce((acc, curr) => decimal(acc).plus(curr.total), decimal(0));
                const taxAmount = decimal(subtotal).times(taxRate).div(100);
                totalAmount = moneyMax(0, decimal(subtotal).plus(taxAmount).minus(discountAmount));
            }
            {
                await prisma.$transaction(async (tx) => {
                    if (processedItems) {
                        // Delete existing items and recreate
                        await tx.proposalItem.deleteMany({
                            where: { proposalId: id },
                        });
                        await tx.proposalItem.createMany({
                            data: processedItems.map((item) => ({
                                id: item.id,
                                proposalId: id,
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                total: item.total,
                                panelBrand: item.panelBrand,
                                systemPrice: item.systemPrice,
                                ksebFee: item.ksebFee,
                                afterSubsidy: item.afterSubsidy,
                                itemTaxRate: item.itemTaxRate,
                            })),
                        });
                    }
                    await tx.proposal.update({
                        where: { id },
                        data: {
                            ...updateFields,
                            ...(processedItems ? {
                                subtotal,
                                taxAmount: decimal(subtotal).times(taxRate).div(100),
                                totalAmount,
                            } : {}),
                            updatedAt: new Date(),
                        },
                    });
                }, { maxWait: 15000, timeout: 30000 });
            }
            return { success: true, message: 'Proposal updated successfully' };
        }
        catch (error) {
            console.error('Error updating proposal:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to update proposal',
            };
        }
    }
    const deleteProposalSchema = z.object({ id: z.string().min(1) });
    async function deleteProposal(input: unknown) {
        const { id } = deleteProposalSchema.parse(input ?? {});
        try {
            {
                await prisma.proposal.delete({
                    where: { id },
                });
            }
            return { success: true, message: 'Proposal deleted successfully' };
        }
        catch (error) {
            console.error('Error deleting proposal:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to delete proposal',
            };
        }
    }
    return { getProposals, getProposalById, createProposal, updateProposal, deleteProposal };
}
