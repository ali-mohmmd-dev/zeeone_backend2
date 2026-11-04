import type { Prisma } from '@prisma/client';




export interface ServiceBilling {
    id: string;
    serviceIds: string[];
    total: Prisma.Decimal.Value;
    billId: string;
    admissionId: string;
    status: "PARTIALLY_PAID" | "PAID" | "UNPAID";
    billDate: Date;
    updatedAt: Date;
    paid: Prisma.Decimal.Value;
    balance: Prisma.Decimal.Value;
}

export interface CreateServiceBilling {
    serviceIds: string[];
    billDate:Date
    paymentMode?: string;
    admissionId: string;
    paid?: Prisma.Decimal.Value;
}

export interface UpdateServiceBilling {
    serviceIds?: string[];
    id: string;
}


export interface DeleteServiceBilling {
    id: string;
}


export interface ServiceBillingWithAdmission {
  id: string;
  serviceIds: string[];
  total: Prisma.Decimal.Value;
  admissionId: string;
  paid: Prisma.Decimal.Value;
  balance: Prisma.Decimal.Value;
  billDate: Date;
  billId: string;
  updatedAt: Date;
  status : "PAID" | "UNPAID" | "PARTIALLY_PAID";
  admission: {
    id?: string;
    candidateName: string;
    admissionNumber: string;
    course?: {
      id: string;
      name: string;
      duration?: string | null;
      courseFee?: Prisma.Decimal.Value | null;
      admissionFee?: Prisma.Decimal.Value | null;
      semesterFee?: Prisma.Decimal.Value | null;
    } | null;
  };
  services?: Array<{
    id: string;
    name: string;
    price: Prisma.Decimal.Value;
  }>;
}


export interface PayServiceBilling {
  id: string;
  paid: Prisma.Decimal.Value;
  paymentMode?: string;
}

export interface ServiceBillItem {
  id: string;
  serviceBillId: string;
  amount: Prisma.Decimal.Value;
  paymentMode: string | null;
  createdAt: Date;
  updatedAt: Date;
}