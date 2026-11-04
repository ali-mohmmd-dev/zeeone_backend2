import { decimal } from '../../shared/utils/money.js';
import { PrismaClient, Prisma, EnquiryStatus, InvoiceStatus } from '@prisma/client';

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  async getTelecallerPerformance(startDate?: string, endDate?: string) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const hasDateFilter = startDate || endDate;

    const telecallers = await this.prisma.user.findMany({
      where: { role: 'telecaller' },
      select: {
        id: true,
        name: true,
        email: true,
        branch: true,
      },
    });

    const results = await Promise.all(
      telecallers.map(async (tc) => {
        const [totalCalls, totalEnquiries, enrolledEnquiries, callLogs] = await Promise.all([
          this.prisma.callLog.count({
            where: {
              createdByUserId: tc.id,
              ...(hasDateFilter ? { callDate: dateFilter } : {}),
            },
          }),
          this.prisma.enquiry.count({
            where: {
              assignedToUserId: tc.id,
              ...(hasDateFilter ? { createdAt: dateFilter } : {}),
            },
          }),
          this.prisma.enquiry.count({
            where: {
              assignedToUserId: tc.id,
              status: EnquiryStatus.CONFIRMED,
              ...(hasDateFilter ? { updatedAt: dateFilter } : {}),
            },
          }),
          this.prisma.callLog.findMany({
            where: {
              createdByUserId: tc.id,
              ...(hasDateFilter ? { callDate: dateFilter } : {}),
            },
            select: { duration: true, outcome: true },
          }),
        ]);

        const totalDuration = callLogs.reduce((sum, c) => sum + (c.duration || 0), 0);
        const answeredCalls = callLogs.filter(
          (c) => c.outcome && !c.outcome.toLowerCase().includes('not answered') && !c.outcome.toLowerCase().includes('busy')
        ).length;
        const conversionRate = totalEnquiries > 0 ? Math.round((enrolledEnquiries / totalEnquiries) * 100) : 0;

        return {
          telecaller: tc,
          metrics: {
            totalCalls,
            answeredCalls,
            totalDuration,
            totalEnquiries,
            enrolledEnquiries,
            conversionRate,
          },
        };
      })
    );

    return results;
  }

  async getBranchAnalytics(startDate?: string, endDate?: string) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const branches = await this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });

    const results = await Promise.all(
      branches.map(async (b) => {
        const [totalEnquiries, totalAdmissions, enrolledCount] = await Promise.all([
          this.prisma.enquiry.count({
            where: {
              branchId: b.id,
              ...(hasDateFilter ? { createdAt: dateFilter } : {}),
            },
          }),
          this.prisma.admission.count({
            where: {
              enquiry: { branchId: b.id },
              ...(hasDateFilter ? { createdAt: dateFilter } : {}),
            },
          }),
          this.prisma.enquiry.count({
            where: {
              branchId: b.id,
              status: EnquiryStatus.CONFIRMED,
              ...(hasDateFilter ? { updatedAt: dateFilter } : {}),
            },
          }),
        ]);

        return {
          branch: b,
          totalEnquiries,
          totalAdmissions,
          enrolledCount,
        };
      })
    );

    return results;
  }

  async getPaymentReport(startDate?: string, endDate?: string) {
    const where: Prisma.ReceiptWhereInput = {};
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [receipts, admissions] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        include: {
          admission: { select: { candidateName: true, admissionNumber: true } },
          course: { select: { name: true } },
        },
      }),
      this.prisma.admission.findMany({
        select: { balance: true },
      }),
    ]);

    const totalCollected = receipts.reduce((sum, r) => decimal(sum).plus(r.amountCollected), decimal(0));
    const totalPendingBalance = admissions.reduce((sum, a) => decimal(sum).plus((a.balance || 0)), decimal(0));

    return {
      summary: {
        totalCollected,
        totalPendingBalance,
        receiptCount: receipts.length,
      },
      receipts,
    };
  }

  async getExpenseReport(startDate?: string, endDate?: string) {
    const where: Prisma.ExpenseWhereInput = {};
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    const totalExpense = expenses.reduce((sum, e) => decimal(sum).plus(e.amount), decimal(0));
    const categoryBreakdown: Record<string, Prisma.Decimal> = {};

    for (const e of expenses) {
      categoryBreakdown[e.category] = decimal(categoryBreakdown[e.category] || 0).plus(e.amount);
    }

    return {
      summary: {
        totalExpense,
        expenseCount: expenses.length,
        categoryBreakdown,
      },
      expenses,
    };
  }

  async getInvoiceReport(startDate?: string, endDate?: string) {
    const where: Prisma.InvoiceWhereInput = {};
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
    });

    const totalInvoiced = invoices.reduce((sum, inv) => decimal(sum).plus(inv.totalAmount), decimal(0));
    const totalTax = invoices.reduce((sum, inv) => decimal(sum).plus(inv.taxAmount), decimal(0));
    const paidInvoices = invoices.filter((i) => i.status === InvoiceStatus.PAID);
    const totalPaid = paidInvoices.reduce((sum, inv) => decimal(sum).plus(inv.totalAmount), decimal(0));

    return {
      summary: {
        totalInvoiced,
        totalTax,
        totalPaid,
        totalInvoices: invoices.length,
        paidCount: paidInvoices.length,
        pendingCount: invoices.length - paidInvoices.length,
      },
      invoices,
    };
  }
}
