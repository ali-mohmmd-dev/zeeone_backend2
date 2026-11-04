import type { Prisma } from '@prisma/client';
import { decimal } from '../../shared/utils/money.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { createProposalProposalActionsService } from './proposal-proposal-actions.service.js';
import { Proposal } from './support/types/proposal.js';
export interface RequiredCapacity {
    id: string;
    name: string; // e.g. "3 KW"
    brand?: string | null; // e.g. "WAREE"
    courseFee: Prisma.Decimal.Value;
    admissionFee: Prisma.Decimal.Value;
    grandTotal: Prisma.Decimal.Value;
    afterSubsidy?: Prisma.Decimal.Value | null;
    description?: string | null;
}
export interface InvoiceProductItem {
    id: string;
    name: string;
    price: Prisma.Decimal.Value;
    category: 'capacity' | 'proposal' | 'component';
    description?: string;
    quantity?: number;
    capacityId?: string;
    brand?: string;
    proposalId?: string;
    proposalNo?: string;
    clientName?: string;
    clientPhone?: string;
}
export interface ProposalMatch {
    id: string;
    proposalNo: string;
    clientName: string;
    clientPhone?: string;
    totalAmount: Prisma.Decimal.Value;
    items: Array<{
        id?: string;
        description: string;
        quantity: number;
        unitPrice: Prisma.Decimal.Value;
        total: Prisma.Decimal.Value;
    }>;
}
export function createInvoiceCatalogActionsService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const getProposals = createProposalProposalActionsService(prisma, currentUser).getProposals;
    async function getInvoiceProductCatalog(customerQuery?: {
        id?: string;
        name?: string;
        phone?: string;
        email?: string;
        sourceType?: string;
    }): Promise<{
        success: boolean;
        catalog: InvoiceProductItem[];
        requiredCapacities: RequiredCapacity[];
        matchingProposals: ProposalMatch[];
    }> {
        try {
            const catalogItems: InvoiceProductItem[] = [];
            const requiredCapacities: RequiredCapacity[] = [];
            const matchingProposals: ProposalMatch[] = [];
            // 1. Fetch Required Capacities created in /admin/data-management (Course table)
            const courses = await prisma.course.findMany({
                where: { NOT: { isActive: false } },
                orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
            });
            for (const course of courses) {
                const brandStr = course.duration ? ` (${course.duration})` : '';
                const price = decimal(course.courseFee);
                const kseb = decimal(course.admissionFee);
                const grandTotal = decimal(price).plus(kseb);
                const afterSubsidy = course.semesterFee !== null && course.semesterFee !== undefined
                    ? course.semesterFee
                    : decimal(price).greaterThanOrEqualTo(150000) && !course.name.includes('3+5')
                        ? decimal(price).minus(78000)
                        : null;
                requiredCapacities.push({
                    id: course.id,
                    name: course.name,
                    brand: course.duration,
                    courseFee: price,
                    admissionFee: kseb,
                    grandTotal: decimal(grandTotal).greaterThan(0) ? grandTotal : price,
                    afterSubsidy,
                    description: course.description,
                });
                // Full Package Option (Price + KSEB fee)
                catalogItems.push({
                    id: `course-full-${course.id}`,
                    name: `${course.name} Solar System${brandStr} - Full Package`,
                    price: decimal(grandTotal).greaterThan(0) ? grandTotal : price,
                    category: 'capacity',
                    capacityId: course.id,
                    brand: course.duration || undefined,
                    description: course.description ||
                        `${course.name} On-Grid Solar System with ${course.duration || 'Tier-1'} Panels. KSEB Fee: ₹${kseb.toFixed(2)}. Grand Total: ₹${grandTotal.toFixed(2)}.`,
                });
                // If KSEB fee is defined, also allow selecting the system price alone
                if (decimal(kseb).greaterThan(0) && decimal(price).greaterThan(0)) {
                    catalogItems.push({
                        id: `course-sys-${course.id}`,
                        name: `${course.name} Solar System${brandStr} - System Price`,
                        price: price,
                        category: 'capacity',
                        capacityId: course.id,
                        brand: course.duration || undefined,
                        description: `${course.name} On-Grid Solar System with ${course.duration || 'Tier-1'} Panels.`,
                    });
                    // KSEB Net Metering line item
                    catalogItems.push({
                        id: `course-kseb-${course.id}`,
                        name: `${course.name} KSEB Net Metering & Feasibility Fee`,
                        price: kseb,
                        category: 'capacity',
                        capacityId: course.id,
                        description: `KSEB application registration, feasibility inspection, and bi-directional net meter testing for ${course.name} system.`,
                    });
                }
            }
            // 2. If a specific customer/enquiry was selected, check if they have a preferred course in Enquiry
            if (customerQuery?.id || customerQuery?.phone || customerQuery?.name) {
                try {
                    const cleanId = customerQuery.id ? customerQuery.id.replace(/^(enquiry|admission|customer):/, '') : '';
                    const enquiry = await prisma.enquiry.findFirst({
                        where: {
                            OR: [
                                ...(cleanId ? [{ id: cleanId }] : []),
                                ...(customerQuery.phone ? [{ phone: customerQuery.phone }] : []),
                                ...(customerQuery.name ? [{ candidateName: customerQuery.name }] : []),
                            ],
                        },
                        include: { preferredCourse: true },
                    });
                    if (enquiry?.preferredCourse) {
                        const pref = enquiry.preferredCourse;
                        const prefBrand = pref.duration ? ` (${pref.duration})` : '';
                        const prefPrice = decimal(pref.courseFee);
                        const prefKseb = decimal(pref.admissionFee);
                        const prefTotal = decimal(prefPrice).plus(prefKseb);
                        const prefItem: InvoiceProductItem = {
                            id: `enquiry-pref-${pref.id}`,
                            name: `⭐ [Enquiry Preferred] ${pref.name} Solar System${prefBrand}`,
                            price: decimal(prefTotal).greaterThan(0) ? prefTotal : prefPrice,
                            category: 'capacity',
                            capacityId: pref.id,
                            description: pref.description ||
                                `${pref.name} Solar System enquired by ${enquiry.candidateName}. KSEB Fee: ₹${prefKseb.toFixed(2)}. Total: ₹${prefTotal.toFixed(2)}.`,
                        };
                        // Prioritize enquiry preferred system at top of catalog
                        catalogItems.unshift(prefItem);
                    }
                }
                catch (err) {
                    console.warn('Could not inspect enquiry preferred course:', err);
                }
            }
            // 3. Fetch proposals created for enquiries / clients
            try {
                const proposalRes = { data: await getProposals() };
                const proposals: Proposal[] = proposalRes?.data?.success && Array.isArray(proposalRes.data.data)
                    ? proposalRes.data.data
                    : Array.isArray(proposalRes?.data)
                        ? (proposalRes.data as unknown as Proposal[])
                        : [];
                for (const proposal of proposals) {
                    // Check if this proposal matches the selected customer / enquiry
                    if (customerQuery?.name || customerQuery?.phone || customerQuery?.id) {
                        const nameMatch = customerQuery.name &&
                            proposal.clientName &&
                            (proposal.clientName.toLowerCase().includes(customerQuery.name.toLowerCase()) ||
                                customerQuery.name.toLowerCase().includes(proposal.clientName.toLowerCase()));
                        const phoneMatch = customerQuery.phone &&
                            proposal.clientPhone &&
                            (proposal.clientPhone.replace(/\D/g, '').endsWith(customerQuery.phone.replace(/\D/g, '').slice(-10)) ||
                                customerQuery.phone.replace(/\D/g, '').endsWith(proposal.clientPhone.replace(/\D/g, '').slice(-10)));
                        const leadMatch = customerQuery.id &&
                            proposal.leadId &&
                            customerQuery.id.includes(proposal.leadId);
                        const enquiryMatch = customerQuery.id &&
                            proposal.enquiryId &&
                            customerQuery.id.includes(proposal.enquiryId);
                        if (nameMatch || phoneMatch || leadMatch || enquiryMatch) {
                            matchingProposals.push({
                                id: proposal.id,
                                proposalNo: proposal.proposalNo,
                                clientName: proposal.clientName,
                                clientPhone: proposal.clientPhone || undefined,
                                totalAmount: proposal.totalAmount,
                                items: (proposal.items || []).map((item) => ({
                                    id: item.id,
                                    description: item.description,
                                    quantity: item.quantity || 1,
                                    unitPrice: decimal(item.unitPrice),
                                    total: item.total || decimal(item.quantity || 1).times((item.unitPrice || 0)),
                                })),
                            });
                        }
                    }
                    // Add unique items from proposals to the catalog under 'proposal' category
                    if (proposal.items && Array.isArray(proposal.items)) {
                        for (const item of proposal.items) {
                            if (item.description && item.description.trim()) {
                                const trimmedDesc = item.description.trim();
                                const alreadyExists = catalogItems.some((existing) => existing.name.toLowerCase() === trimmedDesc.toLowerCase());
                                if (!alreadyExists) {
                                    catalogItems.push({
                                        id: `prop-item-${item.id || Math.random().toString(36).slice(2, 9)}`,
                                        name: trimmedDesc,
                                        price: decimal(item.unitPrice),
                                        quantity: item.quantity || 1,
                                        category: 'proposal',
                                        description: trimmedDesc,
                                        proposalId: proposal.id,
                                        proposalNo: proposal.proposalNo,
                                        clientName: proposal.clientName,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            catch (proposalErr) {
                console.warn('Could not load external proposals:', proposalErr);
            }
            return {
                success: true,
                catalog: catalogItems,
                requiredCapacities,
                matchingProposals,
            };
        }
        catch (error) {
            console.error('Error fetching invoice product catalog:', error);
            return {
                success: false,
                catalog: [],
                requiredCapacities: [],
                matchingProposals: [],
            };
        }
    }
    return { getInvoiceProductCatalog };
}
