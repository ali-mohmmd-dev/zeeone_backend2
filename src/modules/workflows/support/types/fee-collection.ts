import { moneySchema } from '../../../../shared/utils/money.schemas.js';
import { decimal } from '../../../../shared/utils/money.js';
import type { Prisma } from '@prisma/client';
import { z } from "zod";

/**
 * Enum representing the different types of fees that can be collected
 */
export enum CollectedTowards {
  ADMISSION_FEE = "ADMISSION_FEE",
  COURSE_FEE = "COURSE_FEE",
  SEMESTER_FEE = "SEMESTER_FEE",
  OTHER = "OTHER",
}

/**
 * Interface representing a receipt in the system
 */
import { User, AdmissionStatus } from "@prisma/client";

export interface Receipt {
  id: string;
  receiptNumber: string;
  amountCollected: Prisma.Decimal.Value;
  collectedTowards: CollectedTowards;
  paymentDate: Date;
  paymentMode: string;
  transactionId?: string;
  notes?: string;
  admissionId: string;
  courseId: string;
  createdBy: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseFee {
  id: string;
  name: string;
  courseFee: Prisma.Decimal.Value | null;
  admissionFee: Prisma.Decimal.Value | null;
  semesterFee: Prisma.Decimal.Value | null;
  agentCommission: Prisma.Decimal.Value | null;
}

/**
 * Interface representing an admission with its receipts and course details
 */
export interface AdmissionWithReceiptsAndCourse {
  id: string;
  admissionNumber: string;
  candidateName: string;
  status?: AdmissionStatus;
  totalFee?: Prisma.Decimal.Value;
  balance: Prisma.Decimal.Value;
  agentName?: string;
  agentCommission?: Prisma.Decimal.Value;
  nextDueDate?: Date;
  receipts: Receipt[];
  course: CourseFee;
}

/**
 * Input type for creating a new receipt
 */
export interface CreateReceiptInput {
  receiptNumber: string;
  amountCollected: Prisma.Decimal.Value;
  collectedTowards: CollectedTowards;
  paymentDate: Date;
  nextDueDate: Date;
  paymentMode: string;
  transactionId?: string;
  notes?: string;
  admissionId: string;
  courseId: string;
}

/**
 * Input type for updating an existing receipt
 */
export interface UpdateReceiptInput {
  id: string;
  receiptNumber?: string;
  amountCollected?: Prisma.Decimal.Value;
  collectedTowards?: CollectedTowards;
  paymentDate: Date;
  nextDueDate: Date;
  paymentMode?: string;
  transactionId?: string;
  notes?: string;
}

/**
 * Function to create receipt form schema with dynamic validation
 */
export const receiptFormSchema = (balance?: Prisma.Decimal.Value, admissionFee?: Prisma.Decimal.Value) => {
  return z
    .object({
      receiptNumber: z
        .string()
        .min(1, { message: "Receipt number is required" }),
      amountCollected: moneySchema.refine((value) => value.greaterThanOrEqualTo(1), { message: "Amount must be greater than 0" }).refine((amount) => {
            // Validate amount against maximum allowed
            if (balance && decimal(amount).greaterThan(balance)) {
              return false;
            }
            return true;
          }, {
            message: `Amount cannot exceed the remaining balance: ${balance}`,
          }),
      collectedTowards: z.nativeEnum(CollectedTowards, {
        required_error: "Please select a fee type",
      }),
      paymentDate: z.coerce.date({
        required_error: "Payment date is required",
      }),
      nextDueDate: z.coerce.date({
        required_error: "Next due date is required",
      }),
      paymentMode: z.string().min(1, { message: "Payment mode is required" }),
      transactionId: z.string().optional(),
      notes: z.string().optional(),
    })
    .refine(
      (data) => {
        // If payment mode is not CASH, transaction ID is required
        if (
          data.paymentMode !== "CASH" &&
          (!data.transactionId || data.transactionId.trim() === "")
        ) {
          return false;
        }
        return true;
      },
      {
        message: "Transaction ID is required for non-cash payments",
        path: ["transactionId"],
      }
    )
    .refine(
      (data) => {
        // If collecting towards admission fee, amount cannot exceed admission fee
        if (
          data.collectedTowards === CollectedTowards.ADMISSION_FEE &&
          admissionFee &&
          decimal(data.amountCollected).greaterThan(admissionFee)
        ) {
          return false;
        }
        return true;
      },
      {
        message: `Amount cannot exceed the admission fee: ${admissionFee}`,
        path: ["amountCollected"],
      }
    );
};

/**
 * Type for receipt form data
 */
export type ReceiptFormData = z.infer<ReturnType<typeof receiptFormSchema>>;

/**
 * Type for fee calculation results
 */
export interface FeeCalculationResult {
  courseFee: Prisma.Decimal.Value;
  admissionFee: Prisma.Decimal.Value;
  semesterFee?: Prisma.Decimal.Value | null;
  balance: Prisma.Decimal.Value;
  nextDueDate?: Date;
  totalFee: Prisma.Decimal.Value;
  totalPaid: Prisma.Decimal.Value;
}
