import { decimal } from '../../shared/utils/money.js';
import { PrismaClient, Prisma, FollowUpStatus, EnquiryStatus } from '@prisma/client';

export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  async getDashboardStats(user: { id: string; role: string | null; branch?: string | null }) {
    const isTelecaller = user.role === 'telecaller';
    const enquiryWhere: Prisma.EnquiryWhereInput = isTelecaller ? { assignedToUserId: user.id } : {};
    const followUpWhere: Prisma.FollowUpWhereInput = isTelecaller ? { enquiry: { assignedToUserId: user.id } } : {};
    const callLogWhere: Prisma.CallLogWhereInput = isTelecaller ? { createdByUserId: user.id } : {};

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      totalEnquiries,
      newEnquiries,
      enrolledEnquiries,
      pendingFollowUps,
      overdueFollowUps,
      todayFollowUps,
      totalCalls,
      totalAdmissions,
      recentFollowUps,
      recentCallLogs,
    ] = await Promise.all([
      this.prisma.enquiry.count({ where: enquiryWhere }),
      this.prisma.enquiry.count({ where: { ...enquiryWhere, status: EnquiryStatus.NEW } }),
      this.prisma.enquiry.count({ where: { ...enquiryWhere, status: EnquiryStatus.CONFIRMED } }),
      this.prisma.followUp.count({ where: { ...followUpWhere, status: FollowUpStatus.PENDING } }),
      this.prisma.followUp.count({
        where: {
          ...followUpWhere,
          status: FollowUpStatus.PENDING,
          scheduledAt: { lt: startOfToday },
        },
      }),
      this.prisma.followUp.count({
        where: {
          ...followUpWhere,
          scheduledAt: { gte: startOfToday, lte: endOfToday },
        },
      }),
      this.prisma.callLog.count({ where: callLogWhere }),
      isTelecaller ? 0 : this.prisma.admission.count(),
      this.prisma.followUp.findMany({
        where: followUpWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          enquiry: { select: { id: true, candidateName: true, phone: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.callLog.findMany({
        where: callLogWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          enquiry: { select: { id: true, candidateName: true, phone: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    const recentActivities = [
      ...recentFollowUps.map((f) => ({
        id: f.id,
        type: 'FOLLOW_UP',
        title: `Follow-up: ${f.status}`,
        description: f.notes || f.outcome || '',
        createdAt: f.createdAt,
        enquiry: f.enquiry,
        createdBy: f.createdBy,
      })),
      ...recentCallLogs.map((c) => ({
        id: c.id,
        type: 'CALL_LOG',
        title: `Call (${c.duration || 0} mins)`,
        description: c.notes || c.outcome || '',
        createdAt: c.createdAt,
        enquiry: c.enquiry,
        createdBy: c.createdBy,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const conversionRate = totalEnquiries > 0 ? Math.round((enrolledEnquiries / totalEnquiries) * 100) : 0;

    let financialStats = null;
    if (!isTelecaller) {
      const [receiptsSum, expensesSum, admissions] = await Promise.all([
        this.prisma.receipt.aggregate({ _sum: { amountCollected: true } }),
        this.prisma.expense.aggregate({ _sum: { amount: true } }),
        this.prisma.admission.findMany({ select: { balance: true } }),
      ]);

      const totalRevenue = decimal(receiptsSum._sum.amountCollected);
      const totalExpense = decimal(expensesSum._sum.amount);
      const totalPendingBalance = admissions.reduce((sum, a) => decimal(sum).plus((a.balance || 0)), decimal(0));

      financialStats = {
        totalRevenue,
        totalExpense,
        netIncome: decimal(totalRevenue).minus(totalExpense),
        totalPendingBalance,
      };
    }

    return {
      metrics: {
        totalEnquiries,
        newEnquiries,
        enrolledEnquiries,
        conversionRate,
        pendingFollowUps,
        overdueFollowUps,
        todayFollowUps,
        totalCalls,
        totalAdmissions,
      },
      financialStats,
      recentActivities,
    };
  }

  async getRecentActivities(user: { id: string; role: string | null }, limit: number = 20) {
    const isTelecaller = user.role === 'telecaller';
    const followUpWhere: Prisma.FollowUpWhereInput = isTelecaller ? { enquiry: { assignedToUserId: user.id } } : {};
    const callLogWhere: Prisma.CallLogWhereInput = isTelecaller ? { createdByUserId: user.id } : {};

    const [followUps, callLogs] = await Promise.all([
      this.prisma.followUp.findMany({
        where: followUpWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          enquiry: { select: { id: true, candidateName: true, phone: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.callLog.findMany({
        where: callLogWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          enquiry: { select: { id: true, candidateName: true, phone: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    return [
      ...followUps.map((f) => ({
        id: f.id,
        type: 'FOLLOW_UP',
        title: `Follow-up: ${f.status}`,
        description: f.notes || f.outcome || '',
        createdAt: f.createdAt,
        enquiry: f.enquiry,
        createdBy: f.createdBy,
      })),
      ...callLogs.map((c) => ({
        id: c.id,
        type: 'CALL_LOG',
        title: `Call (${c.duration || 0} mins)`,
        description: c.notes || c.outcome || '',
        createdAt: c.createdAt,
        enquiry: c.enquiry,
        createdBy: c.createdBy,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
  }
}
