import { decimal, moneyMax } from '../../shared/utils/money.js';
import {
  PrismaClient,
  Prisma,
  AdmissionStatus,
  CollectedTowards,
  EnquiryStatus,
} from '@prisma/client';
import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import {
  AdmissionFilterInput,
  CreateAdmissionInput,
  UpdateAdmissionInput,
} from './admission.schema.js';

export class AdmissionService {
  constructor(private prisma: PrismaClient) {}

  async listAdmissions(filters: AdmissionFilterInput) {
    const { search, courseId, status, startDate, endDate, page, limit } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.AdmissionWhereInput = {};

    if (courseId) where.courseId = courseId;
    if (status) where.status = status as AdmissionStatus;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (search) {
      where.OR = [
        { candidateName: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [admissions, total] = await Promise.all([
      this.prisma.admission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, name: true, courseFee: true } },
          handledBy: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          _count: {
            select: { receipts: true },
          },
        },
      }),
      this.prisma.admission.count({ where }),
    ]);

    return { admissions, total };
  }

  async getAdmissionById(id: string) {
    const admission = await this.prisma.admission.findUnique({
      where: { id },
      include: {
        course: true,
        enquiry: true,
        handledBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        receipts: {
          orderBy: { paymentDate: 'desc' },
          include: { createdBy: { select: { id: true, name: true } } },
        },
      },
    });

    if (!admission) throw new NotFoundError('Admission');
    return admission;
  }

  async createAdmission(input: CreateAdmissionInput, currentUserId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: input.courseId },
    });

    if (!course) throw new BadRequestError('Selected course does not exist');

    const totalCourseFee = decimal(course.courseFee || 0).plus((course.admissionFee || 0)).plus((course.semesterFee || 0));
    const initialPaid = input.initialPayment ? input.initialPayment.amount : 0;
    const initialBalance = moneyMax(0, decimal(totalCourseFee).minus(initialPaid));

    return this.prisma.$transaction(async (tx) => {
      // Generate unique admission number ADM-YYYYMM-XXXX
      const count = await tx.admission.count();
      const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
      const admissionNumber = `ADM-${datePrefix}-${String(count + 1).padStart(4, '0')}`;

      const admission = await tx.admission.create({
        data: {
          admissionNumber,
          candidateName: input.candidateName,
          mobileNumber: input.mobileNumber,
          email: input.email,
          gender: input.gender,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          address: input.address,
          leadSource: input.leadSource,
          lastQualification: input.lastQualification,
          yearOfPassing: input.yearOfPassing,
          percentageCGPA: input.percentageCGPA,
          instituteName: input.instituteName,
          additionalNotes: input.additionalNotes,
          balance: initialBalance,
          status: input.status as AdmissionStatus,
          courseId: input.courseId,
          enquiryId: input.enquiryId || undefined,
          agentName: input.agentName,
          agentCommission: input.agentCommission,
          handledByUserId: input.handledByUserId || undefined,
          createdByUserId: currentUserId,
        },
      });

      // If initial receipt was provided
      if (input.initialPayment && decimal(input.initialPayment.amount).greaterThan(0)) {
        const receiptCount = await tx.receipt.count();
        const receiptNumber = `RCP-${datePrefix}-${String(receiptCount + 1).padStart(4, '0')}`;

        await tx.receipt.create({
          data: {
            receiptNumber,
            amountCollected: input.initialPayment.amount,
            collectedTowards: input.initialPayment.collectedTowards as CollectedTowards,
            paymentMode: input.initialPayment.paymentMode,
            transactionId: input.initialPayment.transactionId,
            admissionId: admission.id,
            courseId: input.courseId,
            createdById: currentUserId,
          },
        });
      }

      // If created from an enquiry, mark the enquiry as CONFIRMED.
      if (input.enquiryId) {
        await tx.enquiry.update({
          where: { id: input.enquiryId },
          data: { status: EnquiryStatus.CONFIRMED },
        });
      }

      return admission;
    });
  }

  async updateAdmission(id: string, input: UpdateAdmissionInput) {
    await this.getAdmissionById(id);

    return this.prisma.admission.update({
      where: { id },
      data: {
        ...input,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      },
    });
  }

  async deleteAdmission(id: string) {
    await this.getAdmissionById(id);
    return this.prisma.admission.delete({ where: { id } });
  }
}
