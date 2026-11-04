import { PrismaClient } from '@prisma/client';
import { CreateCustomerInput } from './customer.schema.js';
import { NotFoundError } from '../../errors/app-error.js';

export class CustomerService {
  constructor(private prisma: PrismaClient) {}

  async listInvoiceCustomers() {
    const [saved, admissions, enquiries] = await Promise.all([
      this.prisma.customer.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.admission.findMany({
        select: { id: true, candidateName: true, email: true, mobileNumber: true, address: true },
        orderBy: { candidateName: 'asc' },
      }),
      this.prisma.enquiry.findMany({
        select: { id: true, candidateName: true, email: true, phone: true, address: true },
        orderBy: { candidateName: 'asc' },
      }),
    ]);

    type InvoiceCustomer = {
      id: string;
      name: string;
      email: string;
      phone: string;
      address: string;
      state: string;
      gstin: string;
      savedCustomer: boolean;
      sourceType?: 'admission' | 'enquiry';
    };
    const customers: InvoiceCustomer[] = [
      ...saved.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        address: customer.address ?? '',
        state: customer.state ?? '',
        gstin: customer.gstin ?? '',
        savedCustomer: true,
      })),
      ...admissions.map((admission) => ({
        id: `admission:${admission.id}`,
        name: admission.candidateName,
        email: admission.email ?? '',
        phone: admission.mobileNumber,
        address: admission.address,
        state: '',
        gstin: '',
        savedCustomer: false,
        sourceType: 'admission' as const,
      })),
      ...enquiries.map((enquiry) => ({
        id: `enquiry:${enquiry.id}`,
        name: enquiry.candidateName,
        email: enquiry.email ?? '',
        phone: enquiry.phone,
        address: enquiry.address ?? '',
        state: '',
        gstin: '',
        savedCustomer: false,
        sourceType: 'enquiry' as const,
      })),
    ];

    const unique = new Map<string, InvoiceCustomer>();
    for (const customer of customers) {
      const identity = customer.email.trim().toLowerCase()
        || customer.phone.replace(/\D/g, '')
        || customer.name.trim().toLowerCase();
      const current = unique.get(identity);
      if (!current) {
        unique.set(identity, customer);
        continue;
      }
      unique.set(identity, {
        ...current,
        name: current.name || customer.name,
        email: current.email || customer.email,
        phone: current.phone || customer.phone,
        address: current.address || customer.address,
        state: current.state || customer.state,
        gstin: current.gstin || customer.gstin,
        id: current.savedCustomer ? current.id : customer.savedCustomer ? customer.id : current.id,
        savedCustomer: current.savedCustomer || customer.savedCustomer,
      });
    }

    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCustomer(input: CreateCustomerInput, currentUserId: string) {
    return this.prisma.customer.create({
      data: {
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        state: input.state || null,
        gstin: input.gstin || null,
        createdByUserId: currentUserId,
      },
    });
  }

  async createCustomerFromAdmission(admissionId: string, currentUserId: string) {
    const admission = await this.prisma.admission.findUnique({ where: { id: admissionId } });
    if (!admission) throw new NotFoundError('Admission');

    const email = admission.email?.trim() || null;
    const phone = admission.mobileNumber.trim() || null;
    const existing = await this.prisma.customer.findFirst({
      where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
    });
    if (existing) return existing;

    return this.prisma.customer.create({
      data: {
        name: admission.candidateName,
        email,
        phone,
        address: admission.address || null,
        createdByUserId: currentUserId,
      },
    });
  }
}
