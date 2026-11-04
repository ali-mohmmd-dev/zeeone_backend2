import { decimal, moneyMax } from '../../shared/utils/money.js';
import { PrismaClient, Prisma, CollectedTowards } from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import { PDFService } from '../../services/pdf/pdf.service.js';
import { CreateReceiptInput, ReceiptFilterInput } from './receipt.schema.js';

export class ReceiptService {
  constructor(private prisma: PrismaClient) {}

  async listReceipts(filters: ReceiptFilterInput) {
    const { admissionId, courseId, paymentMode, startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ReceiptWhereInput = {};
    if (admissionId) where.admissionId = admissionId;
    if (courseId) where.courseId = courseId;
    if (paymentMode) where.paymentMode = paymentMode;

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [receipts, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          admission: {
            select: {
              id: true,
              admissionNumber: true,
              candidateName: true,
              mobileNumber: true,
              balance: true,
            },
          },
          course: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return { receipts, total };
  }

  async getReceiptById(id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: {
        admission: {
          include: {
            course: true,
            receipts: { select: { amountCollected: true } },
          },
        },
        course: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!receipt) throw new NotFoundError('Receipt');
    return receipt;
  }

  async createReceipt(input: CreateReceiptInput, currentUserId: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id: input.admissionId },
    });

    if (!admission) throw new BadRequestError('Admission record not found');

    return this.prisma.$transaction(async (tx) => {
      // Generate unique receipt number: RCP-YYYYMM-XXXX
      const count = await tx.receipt.count();
      const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
      const receiptNumber = `RCP-${datePrefix}-${String(count + 1).padStart(4, '0')}`;

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          amountCollected: input.amountCollected,
          collectedTowards: input.collectedTowards as CollectedTowards,
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          paymentMode: input.paymentMode,
          transactionId: input.transactionId,
          notes: input.notes,
          admissionId: input.admissionId,
          courseId: input.courseId,
          createdById: currentUserId,
        },
      });

      // Update admission balance and nextDueDate
      const newBalance = moneyMax(0, decimal(admission.balance).minus(input.amountCollected));
      await tx.admission.update({
        where: { id: input.admissionId },
        data: {
          balance: newBalance,
          nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : undefined,
        },
      });

      return receipt;
    });
  }

  async deleteReceipt(id: string) {
    const receipt = await this.getReceiptById(id);

    return this.prisma.$transaction(async (tx) => {
      // Revert balance on admission
      await tx.admission.update({
        where: { id: receipt.admissionId },
        data: {
          balance: { increment: receipt.amountCollected },
        },
      });

      return tx.receipt.delete({ where: { id } });
    });
  }

  async generatePDF(id: string) {
    const receipt = await this.getReceiptById(id);
    return PDFService.generateReceiptPDF(receipt);
  }
}
