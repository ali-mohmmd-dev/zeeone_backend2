import type { Prisma } from '@prisma/client';
import { decimal } from '../../../../shared/utils/money.js';
import {
  AdmissionWithReceiptsAndCourse,
  CourseFee,
  FeeCalculationResult,
} from "../types/fee-collection.js";

/**
 * Calculate fee details for an admission
 * @param admission The admission object with course and receipts
 * @returns FeeCalculationResult with detailed fee breakdown
 */
export function calculateFeeDetails(
  admission: AdmissionWithReceiptsAndCourse
): FeeCalculationResult {
  const admissionFee = admission.course.admissionFee || 0;
  const courseFee = admission.course.courseFee || 0;
  const balance = admission.balance || 0;
  const semesterFee = admission.course.semesterFee;

  const totalFee = calculateTotalFee(admission.course);

  return {
    totalFee,
    totalPaid: calculateTotalPaid(admission),
    balance,
    admissionFee,
    courseFee,
    semesterFee,
    nextDueDate: admission.nextDueDate,
  };
}

export function calculateTotalFee(course: CourseFee): Prisma.Decimal {
  const admissionFee = course.admissionFee ?? 0;
  const courseFee = course.courseFee ?? 0;
  const semesterFee = course.semesterFee ?? 0;

  let totalFee = decimal(admissionFee).plus(courseFee).plus(semesterFee);
  if (course.agentCommission) {
    totalFee = totalFee.minus(course.agentCommission);
  }

  return totalFee;
}


export function calculateBalance(balance: Prisma.Decimal.Value, totalPaid: Prisma.Decimal.Value): Prisma.Decimal {
  if (decimal(totalPaid).greaterThan(balance)) {
    return decimal(0);
  }
  return decimal(balance).minus(totalPaid);
}

export const calculateTotalPaid = (admission: AdmissionWithReceiptsAndCourse): Prisma.Decimal =>
  admission.receipts.reduce((sum, receipt) => decimal(sum).plus(receipt.amountCollected), decimal(0));
