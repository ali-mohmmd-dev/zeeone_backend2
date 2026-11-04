import type { Prisma } from '@prisma/client';
export enum ProposalStatus {
    DRAFT = 'DRAFT',
    SENT = 'SUBMITTED',
    ACCEPTED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export interface ProposalItem {
    id: string;
    proposalId: string;
    description: string;
    quantity: number;
    unitPrice: Prisma.Decimal.Value;
    total: Prisma.Decimal.Value;
    panelBrand?: string | null;
    systemPrice?: Prisma.Decimal.Value | null;
    ksebFee?: Prisma.Decimal.Value | null;
    afterSubsidy?: Prisma.Decimal.Value | null;
    itemTaxRate?: Prisma.Decimal.Value;
    createdAt?: string;
    updatedAt?: string;
}

export interface Proposal {
    id: string;
    proposalNo: string;
    title?: string | null;
    leadId?: string | null;
    enquiryId?: string | null;
    clientName: string;
    clientEmail?: string | null;
    clientPhone?: string | null;
    clientAddress?: string | null;
    branch?: string | null;
    branchId?: string | null;
    status: ProposalStatus;
    validUntil?: string | null;
    subtotal?: Prisma.Decimal.Value;
    taxRate?: Prisma.Decimal.Value;
    taxAmount?: Prisma.Decimal.Value;
    discountAmount?: Prisma.Decimal.Value;
    totalAmount: Prisma.Decimal.Value;
    notes?: string | null;
    terms?: string | null;
    createdById?: string | null;
    createdByUser?: string | null;
    items: ProposalItem[];
    createdAt: string; // ISO Date string
    updatedAt: string; // ISO Date string
    enquiry?: {
        id: string;
        candidateName: string;
        phone: string;
        email?: string | null;
        preferredCourse?: {
            id: string;
            name: string;
            courseFee?: Prisma.Decimal.Value | null;
        } | null;
    } | null;
}

export interface CreateProposalInput {
    title?: string;
    leadId?: string;
    enquiryId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    branch?: string;
    branchId?: string;
    status?: ProposalStatus;
    validUntil?: string;
    taxRate?: Prisma.Decimal.Value;
    discountAmount?: Prisma.Decimal.Value;
    notes?: string;
    terms?: string;
    createdByUser?: string;
    items?: {
        description: string;
        quantity: number;
        unitPrice: Prisma.Decimal.Value;
    }[];
}

export interface UpdateProposalInput {
    id: string;
    title?: string;
    status?: ProposalStatus;
    leadId?: string;
    enquiryId?: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    branch?: string;
    branchId?: string;
    validUntil?: string;
    taxRate?: Prisma.Decimal.Value;
    discountAmount?: Prisma.Decimal.Value;
    notes?: string;
    terms?: string;
    items?: {
        id?: string;
        description: string;
        quantity: number;
        unitPrice: Prisma.Decimal.Value;
    }[];
}
