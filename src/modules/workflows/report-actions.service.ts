import type { Prisma } from '@prisma/client';
import { decimal } from '../../shared/utils/money.js';
import { ForbiddenError } from '../../errors/app-error.js';
import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { z } from 'zod';
import { withPrismaRetry } from './database-retry.js';
import { cacheService } from './support/lib/cache/cache-service.js';
import { CACHE_TTL } from './support/lib/cache/cache-keys.js';
import { DateRangeFilter, TelecallerReport, BranchReport, AdmissionPaymentReport, ExpenseReport, InvoiceReport, IncomeReport, PendingPaymentReport, ReportDashboardData, CSVExportData, ReportType, TelecallerEnquiryStats, ExpenseBreakdown, InvoiceStatusBreakdown, IncomeSource, PendingPaymentDetails, } from './support/types/reports.js';
import { EnquiryStatus } from './support/types/enquiry.js';
import { formatDate } from './support/lib/utils.js';
import { formatCurrency } from '../../utils/format.js';
export function createReportActionsService(prisma: PrismaClient, currentUser: WorkflowUser) {
    const dateRangeSchema = z.object({
        from: z.coerce.date(),
        to: z.coerce.date(),
    });
    const reportFiltersSchema = z.object({
        dateRange: dateRangeSchema.optional(),
        branchId: z.string().optional(),
        courseId: z.string().optional(),
        userId: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
    });
    async function getUserAccessibleData(userId: string, userRole: string, userBranch?: string | null) {
        const baseFilter: Record<string, string> = {};
        // For telecallers, only show their assigned data
        if (userRole === 'telecaller') {
            baseFilter.assignedToUserId = userId;
        }
        // For executives and managers, only show data from their assigned branch
        if (['executive', 'manager', 'branch manager'].includes(userRole) && userBranch) {
            baseFilter.branchId = userBranch;
        }
        return baseFilter;
    }
    async function getDateRangeFilter(dateRange?: DateRangeFilter) {
        if (!dateRange) {
            // Default to last 30 days
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);
            return { gte: start, lte: end };
        }
        return { gte: dateRange.from, lte: dateRange.to };
    }
    const getTelecallerPerformanceReportSchema = reportFiltersSchema;
    async function getTelecallerPerformanceReport(input: unknown) {
        if (!["admin"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getTelecallerPerformanceReportSchema.parse(input ?? {}), ctx = { user: currentUser, userId: currentUser.id, userRole: currentUser.role, session: { id: currentUser.id, userId: currentUser.id } };
        const { userId, user } = ctx;
        const userRole = user.role || 'telecaller';
        const accessFilter = await getUserAccessibleData(userId, userRole);
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        // Base query filters
        const baseWhere = {
            ...accessFilter,
            createdAt: dateFilter,
            ...(filters.branchId && filters.branchId !== 'all' && { branchId: filters.branchId }),
            ...(filters.courseId && { preferredCourseId: filters.courseId }),
            ...(filters.status && { status: filters.status as EnquiryStatus }),
        };
        // Get telecaller performance metrics
        const telecallers = await prisma.user.findMany({
            where: {
                role: 'telecaller',
                ...(userRole === 'telecaller' && { id: userId }),
            },
            include: {
                assignedEnquiries: {
                    where: baseWhere,
                    include: {
                        callLogs: true,
                        followUps: true,
                        admissions: true,
                    },
                },
            },
        });
        const performance = telecallers.map((telecaller) => {
            const enquiries = telecaller.assignedEnquiries;
            const totalEnquiries = enquiries.length;
            const callsMade = enquiries.reduce((sum, enq) => sum + enq.callLogs.length, 0);
            const conversions = enquiries.filter((enq) => enq.admissions.length > 0).length;
            const conversionRate = totalEnquiries > 0 ? (conversions / totalEnquiries) * 100 : 0;
            // Calculate average call duration from call logs
            const allCallLogs = enquiries.flatMap((enq) => enq.callLogs);
            const averageCallDuration = allCallLogs.length > 0
                ? Math.round((allCallLogs.reduce((sum, log) => sum + (log.duration || 0), 0) /
                    allCallLogs.length) *
                    10) / 10
                : 0;
            // Calculate follow-up completion rate
            const totalFollowUps = enquiries.reduce((sum, enq) => sum + enq.followUps.length, 0);
            const completedFollowUps = enquiries.reduce((sum, enq) => sum + enq.followUps.filter((f) => f.status === 'COMPLETED').length, 0);
            const followUpCompletion = totalFollowUps > 0 ? (completedFollowUps / totalFollowUps) * 100 : 0;
            // Calculate response time (average time from enquiry creation to first contact)
            const responseTime = enquiries.length > 0
                ? Math.round((enquiries.reduce((sum, enq) => {
                    const firstCall = enq.callLogs[0];
                    if (firstCall) {
                        const responseHours = (firstCall.createdAt.getTime() - enq.createdAt.getTime()) / (1000 * 60 * 60);
                        return sum + responseHours;
                    }
                    return sum + 24; // Default 24 hours if no calls made
                }, 0) /
                    enquiries.length) *
                    10) / 10
                : 0;
            return {
                telecallerId: telecaller.id,
                telecallerName: telecaller.name || 'Unknown',
                totalEnquiries,
                callsMade,
                conversions,
                conversionRate: Math.round(conversionRate * 10) / 10,
                averageCallDuration,
                followUpCompletion: Math.round(followUpCompletion * 10) / 10,
                responseTime,
                period: filters.dateRange || {
                    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    to: new Date(),
                },
            };
        });
        // Get enquiry stats
        const enquiryStats = telecallers.map((telecaller) => {
            const enquiries = telecaller.assignedEnquiries;
            const statusCounts = enquiries.reduce((acc, enq) => {
                acc[enq.status] = (acc[enq.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
                status: status.replace('_', ' '),
                count,
                percentage: enquiries.length > 0 ? Math.round((count / enquiries.length) * 100) : 0,
                color: getStatusColor(status),
            }));
            return {
                telecallerId: telecaller.id,
                telecallerName: telecaller.name || 'Unknown',
                newEnquiries: statusCounts['NEW'] || 0,
                contactedEnquiries: statusCounts['CONTACTED'] || 0,
                interestedEnquiries: statusCounts['CONFIRMED'] || 0,
                enrolledEnquiries: 0,
                droppedEnquiries: statusCounts['DROPPED'] || 0,
                statusDistribution,
            };
        });
        const report: TelecallerReport = {
            performance,
            enquiryStats,
            totalTelecallers: telecallers.length,
            topPerformer: performance.length > 0
                ? performance.reduce((prev, current) => prev.conversionRate > current.conversionRate ? prev : current).telecallerName
                : 'None',
            filters,
        };
        return report;
    }
    const getTelecallerEnquiryStatsSchema = reportFiltersSchema;
    async function getTelecallerEnquiryStats(input: unknown) {
        if (!["admin"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getTelecallerEnquiryStatsSchema.parse(input ?? {}), ctx = { user: currentUser, userId: currentUser.id, userRole: currentUser.role, session: { id: currentUser.id, userId: currentUser.id } };
        const { userId, user } = ctx;
        const userRole = user.role || 'telecaller';
        const accessFilter = await getUserAccessibleData(userId, userRole);
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        const enquiries = await prisma.enquiry.findMany({
            where: {
                ...(accessFilter as Record<string, string>),
                createdAt: dateFilter,
                ...(filters.branchId && filters.branchId !== 'all' && { branchId: filters.branchId }),
                ...(filters.status && { status: filters.status as EnquiryStatus }),
            },
            include: {
                assignedTo: true,
            },
        });
        // Group by telecaller
        const telecallerStats = enquiries.reduce((acc, enquiry) => {
            const telecallerId = enquiry.assignedToUserId || 'unassigned';
            const telecallerName = enquiry.assignedTo?.name || 'Unassigned';
            if (!acc[telecallerId]) {
                acc[telecallerId] = {
                    telecallerId,
                    telecallerName,
                    newEnquiries: 0,
                    contactedEnquiries: 0,
                    interestedEnquiries: 0,
                    enrolledEnquiries: 0,
                    droppedEnquiries: 0,
                    statusDistribution: [],
                };
            }
            // Increment status counts
            switch (enquiry.status) {
                case 'NEW':
                    acc[telecallerId].newEnquiries += 1;
                    break;
                case 'CONTACTED':
                    acc[telecallerId].contactedEnquiries += 1;
                    break;
                case 'CONFIRMED':
                    acc[telecallerId].interestedEnquiries += 1;
                    break;
                case 'DROPPED':
                    acc[telecallerId].droppedEnquiries += 1;
                    break;
            }
            return acc;
        }, {} as Record<string, TelecallerEnquiryStats>);
        return Object.values(telecallerStats);
    }
    const getTelecallerConversionRatesSchema = reportFiltersSchema;
    async function getTelecallerConversionRates(input: unknown) {
        if (!["admin"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getTelecallerConversionRatesSchema.parse(input ?? {}), ctx = { user: currentUser, userId: currentUser.id, userRole: currentUser.role, session: { id: currentUser.id, userId: currentUser.id } };
        const { userId, user } = ctx;
        const userRole = user.role || 'telecaller';
        const accessFilter = await getUserAccessibleData(userId, userRole);
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        const telecallers = await prisma.user.findMany({
            where: {
                role: 'telecaller',
                ...(userRole === 'telecaller' && { id: userId }),
            },
            include: {
                assignedEnquiries: {
                    where: {
                        ...accessFilter,
                        createdAt: dateFilter,
                    },
                    include: {
                        admissions: true,
                    },
                },
            },
        });
        const conversionData = telecallers.map((telecaller) => {
            const enquiries = telecaller.assignedEnquiries;
            const totalEnquiries = enquiries.length;
            const conversions = enquiries.filter((enq) => enq.admissions.length > 0).length;
            const conversionRate = totalEnquiries > 0 ? (conversions / totalEnquiries) * 100 : 0;
            return {
                telecallerId: telecaller.id,
                telecallerName: telecaller.name || 'Unknown',
                totalEnquiries,
                conversions,
                conversionRate: Math.round(conversionRate * 10) / 10,
            };
        });
        return conversionData;
    }
    const getBranchPerformanceReportSchema = reportFiltersSchema;
    async function getBranchPerformanceReport(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getBranchPerformanceReportSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        const branches = await prisma.branch.findMany({
            where: {
                isActive: true,
                ...(filters.branchId && { id: filters.branchId }),
            },
            include: {
                enquiries: {
                    where: {
                        createdAt: dateFilter,
                    },
                    include: {
                        admissions: true,
                    },
                },
            },
        });
        const performance = branches.map((branch) => {
            const enquiries = branch.enquiries;
            const totalEnquiries = enquiries.length;
            const conversions = enquiries.filter((enq) => enq.admissions.length > 0).length;
            const conversionRate = totalEnquiries > 0 ? (conversions / totalEnquiries) * 100 : 0;
            // Mock revenue calculation - implement based on actual requirements
            const totalRevenue = decimal(25000).times(conversions); // Average fee per admission
            const activeStudents = conversions;
            const averageEnquiryValue = totalEnquiries > 0 ? decimal(totalRevenue).div(totalEnquiries) : 0;
            return {
                branchId: branch.id,
                branchName: branch.name,
                totalEnquiries,
                totalAdmissions: conversions,
                conversionRate: Math.round(conversionRate * 10) / 10,
                totalRevenue,
                activeStudents,
                averageEnquiryValue: decimal(averageEnquiryValue).toDecimalPlaces(0),
                period: filters.dateRange || {
                    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    to: new Date(),
                },
            };
        });
        const enquiryDistribution = branches.map((branch) => ({
            branchId: branch.id,
            branchName: branch.name,
            enquiryCount: branch.enquiries.length,
            percentage: 0, // Will be calculated below
            coursePreferences: [], // Mock - implement based on course preferences
        }));
        const totalEnquiries = enquiryDistribution.reduce((sum, b) => sum + b.enquiryCount, 0);
        enquiryDistribution.forEach((branch) => {
            branch.percentage =
                totalEnquiries > 0 ? Math.round((branch.enquiryCount / totalEnquiries) * 100) : 0;
        });
        const report: BranchReport = {
            performance,
            enquiryDistribution,
            totalBranches: branches.length,
            topPerformingBranch: performance.length > 0
                ? performance.reduce((prev, current) => prev.conversionRate > current.conversionRate ? prev : current).branchName
                : 'None',
            filters,
        };
        return report;
    }
    const getBranchAdmissionStatsSchema = reportFiltersSchema;
    async function getBranchAdmissionStats(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getBranchAdmissionStatsSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        const admissionData = await prisma.admission.findMany({
            where: {
                createdAt: dateFilter,
                ...(filters.branchId &&
                    filters.branchId !== 'all' && { enquiry: { branchId: filters.branchId } }),
            },
            include: {
                enquiry: true,
                course: true,
                receipts: true,
            },
        });
        const branchStats = admissionData.reduce((acc, admission) => {
            const branchId = admission.enquiry?.branchId || 'default';
            if (!acc[branchId]) {
                acc[branchId] = {
                    branchId,
                    branchName: `Branch ${branchId}`,
                    totalAdmissions: 0,
                    totalRevenue: decimal(0),
                };
            }
            acc[branchId].totalAdmissions += 1;
            // Calculate revenue from receipts instead of non-existent totalFees
            const admissionRevenue = admission.receipts.reduce((sum, receipt) => decimal(sum).plus(receipt.amountCollected), decimal(0));
            acc[branchId].totalRevenue = decimal(acc[branchId].totalRevenue).plus(admissionRevenue);
            return acc;
        }, {} as Record<string, {
            branchId: string;
            branchName: string;
            totalAdmissions: number;
            totalRevenue: Prisma.Decimal.Value;
        }>);
        return Object.values(branchStats);
    }
    const getAdmissionPaymentReportSchema = reportFiltersSchema;
    async function getAdmissionPaymentReport(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getAdmissionPaymentReportSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        const existingCourses = await prisma.course.findMany({
            select: { id: true },
        });
        console.log('filters', dateFilter);
        const validCourseIds = existingCourses.map(c => c.id);
        const allAdmissions = await prisma.admission.findMany({
            where: {
                courseId: { in: validCourseIds },
            },
        });
        const admissions = await prisma.admission.findMany({
            where: {
                createdAt: dateFilter,
                courseId: { in: validCourseIds },
                ...(filters.search && {
                    OR: [
                        { candidateName: { contains: filters.search, mode: 'insensitive' } },
                        { email: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }),
            },
            include: {
                enquiry: true,
                receipts: true,
                course: true,
            },
        });
        const students = admissions.map((admission) => {
            const agentDiscount = admission.agentCommission || 0;
            const totalPaid = admission.receipts.reduce((sum, receipt) => decimal(sum).plus(receipt.amountCollected), decimal(0));
            // Calculate total fees from course fees instead of non-existent totalFees field
            const totalFees = decimal(admission.course.courseFee || 0).plus((admission.course.admissionFee || 0)).plus((admission.course.semesterFee || 0));
            const outstanding = decimal(totalFees).minus(totalPaid).minus(agentDiscount);
            let status: 'fully_paid' | 'partially_paid' | 'overdue' | 'pending';
            if (decimal(outstanding).lessThanOrEqualTo(0)) {
                status = 'fully_paid';
            }
            else if (decimal(totalPaid).greaterThan(0)) {
                status = 'partially_paid';
            }
            else if (admission.nextDueDate && new Date(admission.nextDueDate) < new Date()) {
                status = 'overdue';
            }
            else {
                status = 'pending';
            }
            return {
                studentId: admission.enquiry?.id || admission.id,
                studentName: admission.candidateName,
                admissionId: admission.id,
                totalFees,
                agentDiscount,
                paidAmount: totalPaid,
                outstandingAmount: outstanding,
                nextDueDate: admission.nextDueDate,
                paymentHistory: admission.receipts.map((receipt) => ({
                    receiptNumber: receipt.receiptNumber,
                    amount: receipt.amountCollected,
                    paymentDate: receipt.createdAt,
                    paymentMode: receipt.paymentMode || 'Cash',
                })),
                status,
            };
        });
        const totalCollected = students.reduce((sum, s) => decimal(sum).plus(s.paidAmount), decimal(0));
        const totalOutstanding = students.reduce((sum, s) => decimal(sum).plus(s.outstandingAmount), decimal(0));
        const totalOverdue = students
            .filter((s) => s.status === 'overdue')
            .reduce((sum, s) => decimal(sum).plus(s.outstandingAmount), decimal(0));
        // Payment mode breakdown
        const paymentModes = admissions.flatMap((a) => a.receipts);
        const paymentModeBreakdown = paymentModes.reduce((acc, receipt) => {
            const mode = receipt.paymentMode || 'Cash';
            const existing = acc.find((p) => p.mode === mode);
            if (existing) {
                existing.amount = decimal(existing.amount).plus(receipt.amountCollected);
                existing.count += 1;
            }
            else {
                acc.push({
                    mode,
                    amount: receipt.amountCollected,
                    count: 1,
                });
            }
            return acc;
        }, [] as {
            mode: string;
            amount: Prisma.Decimal.Value;
            count: number;
        }[]);
        const report: AdmissionPaymentReport = {
            students,
            totalCollected,
            totalOutstanding,
            totalOverdue,
            paymentModeBreakdown,
            filters,
        };
        console.log("all", allAdmissions);
        console.log("students", students);
        return report;
    }
    const getExpenseReportSchema = reportFiltersSchema;
    async function getExpenseReport(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getExpenseReportSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        const expenses = await prisma.expense.findMany({
            where: {
                expenseDate: dateFilter,
                ...(filters.userId && { createdById: filters.userId }),
                ...(filters.search && {
                    OR: [
                        { description: { contains: filters.search, mode: 'insensitive' } },
                        { title: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }),
            },
            include: {
                createdBy: true,
            },
        });
        // Category breakdown
        const categoryMap = expenses.reduce((acc, expense) => {
            const category = expense.category;
            if (!acc[category]) {
                acc[category] = {
                    categoryId: category,
                    categoryName: category,
                    totalAmount: decimal(0),
                    transactionCount: 0,
                    percentage: 0,
                    monthlyTrend: [],
                };
            }
            acc[category].totalAmount = decimal(acc[category].totalAmount).plus(expense.amount);
            acc[category].transactionCount += 1;
            return acc;
        }, {} as Record<string, ExpenseBreakdown>);
        const totalExpenses = expenses.reduce((sum, e) => decimal(sum).plus(e.amount), decimal(0));
        const breakdown = Object.values(categoryMap).map((cat: ExpenseBreakdown) => ({
            ...cat,
            percentage: decimal(totalExpenses).greaterThan(0) ? decimal(cat.totalAmount).div(totalExpenses).times(100).toDecimalPlaces(0).toNumber() : 0,
        }));
        // User-wise expenses
        const userWiseExpenses = expenses.reduce((acc, expense) => {
            const userId = expense.createdById;
            const userName = expense.createdBy?.name || 'Unknown';
            const existing = acc.find((u) => u.userId === userId);
            if (existing) {
                existing.totalAmount = decimal(existing.totalAmount).plus(expense.amount);
                existing.transactionCount += 1;
            }
            else {
                acc.push({
                    userId,
                    userName,
                    totalAmount: expense.amount,
                    transactionCount: 1,
                });
            }
            return acc;
        }, [] as {
            userId: string;
            userName: string;
            totalAmount: Prisma.Decimal.Value;
            transactionCount: number;
        }[]);
        const report: ExpenseReport = {
            breakdown,
            totalExpenses,
            topCategory: breakdown.length > 0
                ? breakdown.reduce((prev, current) => decimal(prev.totalAmount).greaterThan(current.totalAmount) ? prev : current).categoryName
                : 'None',
            monthlyTrend: [], // Implement monthly trend calculation
            userWiseExpenses,
            filters,
        };
        return report;
    }
    const getInvoiceReportSchema = reportFiltersSchema;
    async function getInvoiceReport(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getInvoiceReportSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        const invoices = await prisma.invoice.findMany({
            where: {
                createdAt: dateFilter,
                ...(filters.status &&
                    filters.status !== 'all' && {
                    status: filters.status as 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED',
                }),
                ...(filters.search && {
                    OR: [
                        { billedTo: { contains: filters.search, mode: 'insensitive' } },
                        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
                        { notes: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }),
            },
            include: {
                items: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        // Status breakdown
        const statusBreakdown = invoices.reduce((acc, invoice) => {
            const status = invoice.status.toLowerCase() as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
            const existing = acc.find((s) => s.status === status);
            if (existing) {
                existing.count += 1;
                existing.totalAmount = decimal(existing.totalAmount).plus(invoice.totalAmount);
            }
            else {
                acc.push({
                    status,
                    count: 1,
                    totalAmount: invoice.totalAmount,
                    percentage: 0, // Will calculate below
                });
            }
            return acc;
        }, [] as InvoiceStatusBreakdown[]);
        // Calculate percentages
        const totalInvoices = invoices.length;
        statusBreakdown.forEach((status) => {
            status.percentage = totalInvoices > 0 ? Math.round((status.count / totalInvoices) * 100) : 0;
        });
        const totalRevenue = invoices
            .filter((i) => i.status === 'PAID')
            .reduce((sum, i) => decimal(sum).plus(i.totalAmount), decimal(0));
        const outstandingAmount = invoices
            .filter((i) => ['SENT', 'OVERDUE'].includes(i.status))
            .reduce((sum, i) => decimal(sum).plus(i.totalAmount), decimal(0));
        // Calculate payment timeline (monthly collections)
        const paidInvoices = invoices.filter((i) => i.status === 'PAID');
        const monthlyData = paidInvoices.reduce((acc, invoice) => {
            const monthKey = new Date(invoice.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
            });
            if (!acc[monthKey]) {
                acc[monthKey] = { collected: decimal(0), pending: decimal(0), period: monthKey };
            }
            acc[monthKey].collected = decimal(acc[monthKey].collected).plus(invoice.totalAmount);
            return acc;
        }, {} as Record<string, {
            collected: Prisma.Decimal.Value;
            pending: Prisma.Decimal.Value;
            period: string;
        }>);
        // Add pending amounts to timeline
        const pendingInvoices = invoices.filter((i) => ['SENT', 'OVERDUE'].includes(i.status));
        pendingInvoices.forEach((invoice) => {
            const monthKey = new Date(invoice.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
            });
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { collected: decimal(0), pending: decimal(0), period: monthKey };
            }
            monthlyData[monthKey].pending = decimal(monthlyData[monthKey].pending).plus(invoice.totalAmount);
        });
        const paymentTimeline = Object.values(monthlyData).sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());
        // Calculate aging analysis based on invoice creation dates for all invoices
        const now = new Date();
        const agingAnalysis = [
            { range: '0-30 days', count: 0, amount: decimal(0) },
            { range: '31-60 days', count: 0, amount: decimal(0) },
            { range: '61-90 days', count: 0, amount: decimal(0) },
            { range: '90+ days', count: 0, amount: decimal(0) },
        ];
        // For aging analysis, show all invoices by age from creation date
        invoices.forEach((invoice) => {
            const daysOld = Math.floor((now.getTime() - new Date(invoice.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            if (daysOld <= 30) {
                agingAnalysis[0].count += 1;
                agingAnalysis[0].amount = decimal(agingAnalysis[0].amount).plus(invoice.totalAmount);
            }
            else if (daysOld <= 60) {
                agingAnalysis[1].count += 1;
                agingAnalysis[1].amount = decimal(agingAnalysis[1].amount).plus(invoice.totalAmount);
            }
            else if (daysOld <= 90) {
                agingAnalysis[2].count += 1;
                agingAnalysis[2].amount = decimal(agingAnalysis[2].amount).plus(invoice.totalAmount);
            }
            else {
                agingAnalysis[3].count += 1;
                agingAnalysis[3].amount = decimal(agingAnalysis[3].amount).plus(invoice.totalAmount);
            }
        });
        // Calculate average collection time for paid invoices
        const collectionTimes = paidInvoices.map((invoice) => {
            // For simplicity, assuming collection time is from creation to paid status
            // In real scenario, you'd track status change dates
            return Math.floor((new Date(invoice.updatedAt).getTime() - new Date(invoice.createdAt).getTime()) /
                (1000 * 60 * 60 * 24));
        });
        const averageCollectionTime = collectionTimes.length > 0
            ? Math.round(collectionTimes.reduce((sum, time) => sum + time, 0) / collectionTimes.length)
            : 0;
        // Debug logging
        console.log('Invoice Report Debug:', {
            totalInvoices: invoices.length,
            agingAnalysis,
            statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s.count })),
        });
        const report: InvoiceReport = {
            statusBreakdown,
            totalRevenue,
            outstandingAmount,
            averageCollectionTime,
            paymentTimeline,
            agingAnalysis,
            filters,
        };
        return report;
    }
    const getIncomeReportSchema = reportFiltersSchema;
    async function getIncomeReport(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getIncomeReportSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        // Get income from invoices only (excluding course fees)
        const paidInvoices = await prisma.invoice.findMany({
            where: {
                status: 'PAID',
                createdAt: dateFilter,
                ...(filters.search && {
                    OR: [
                        { billedTo: { contains: filters.search, mode: 'insensitive' } },
                        { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
                        { notes: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }),
            },
            include: {
                items: true, // Include invoice items for detailed analysis
            },
            orderBy: { createdAt: 'desc' },
        });
        const invoiceIncome = paidInvoices.reduce((sum, invoice) => decimal(sum).plus(invoice.totalAmount), decimal(0));
        const totalIncome = invoiceIncome;
        // Categorize invoices by service type/category
        const serviceCategories = paidInvoices.reduce((acc, invoice) => {
            // Use first item's description or invoice notes as category
            const category = invoice.items[0]?.itemDescription || invoice.notes || 'General Services';
            const existing = acc.find((cat) => cat.source === category);
            if (existing) {
                existing.amount = decimal(existing.amount).plus(invoice.totalAmount);
                existing.transactionCount += 1;
            }
            else {
                acc.push({
                    source: category,
                    amount: invoice.totalAmount,
                    percentage: 0, // Will calculate below
                    transactionCount: 1,
                });
            }
            return acc;
        }, [] as IncomeSource[]);
        // Calculate percentages for categories
        serviceCategories.forEach((category) => {
            category.percentage = decimal(totalIncome).greaterThan(0) ? decimal(category.amount).div(totalIncome).times(100).toDecimalPlaces(0).toNumber() : 0;
        });
        // If no categories found, create a default one
        const sources = serviceCategories.length > 0
            ? serviceCategories
            : [
                {
                    source: 'Business Services',
                    amount: invoiceIncome,
                    percentage: 100,
                    transactionCount: paidInvoices.length,
                },
            ];
        // Calculate monthly revenue with growth
        const monthlyData = paidInvoices.reduce((acc, invoice) => {
            const monthKey = new Date(invoice.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
            });
            if (!acc[monthKey]) {
                acc[monthKey] = { amount: decimal(0), month: monthKey, invoiceCount: 0 };
            }
            acc[monthKey].amount = decimal(acc[monthKey].amount).plus(invoice.totalAmount);
            acc[monthKey].invoiceCount += 1;
            return acc;
        }, {} as Record<string, {
            amount: Prisma.Decimal.Value;
            month: string;
            invoiceCount: number;
        }>);
        const monthlyRevenue = Object.values(monthlyData)
            .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
            .map((month, index, array) => {
            const previousMonth = array[index - 1];
            const growth = previousMonth && decimal(previousMonth.amount).greaterThan(0)
                ? decimal(month.amount).minus(previousMonth.amount).div(previousMonth.amount).times(100)
                : 0;
            return {
                month: month.month,
                amount: month.amount,
                growth: decimal(growth).toDecimalPlaces(1).toNumber(),
                invoiceCount: month.invoiceCount,
            };
        });
        // Detailed transactions for the detailed view
        const detailedTransactions = paidInvoices.map((invoice) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.billedTo,
            description: invoice.notes || 'Invoice',
            amount: invoice.totalAmount,
            date: invoice.createdAt,
            itemCount: invoice.items.length,
            category: invoice.items[0]?.itemDescription || invoice.notes || 'General Services',
        }));
        const report: IncomeReport = {
            totalIncome,
            sources,
            monthlyRevenue,
            paymentMethodDistribution: [], // Empty for invoices
            detailedTransactions, // Add detailed transaction data
            filters,
        };
        return report;
    }
    const getPendingPaymentReportSchema = reportFiltersSchema;
    async function getPendingPaymentReport(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getPendingPaymentReportSchema.parse(input ?? {});
        const existingCourses = await prisma.course.findMany({
            select: { id: true },
        });
        const validCourseIds = existingCourses.map(c => c.id);
        const admissions = await prisma.admission.findMany({
            where: {
                courseId: { in: validCourseIds },
                ...(filters.search && {
                    OR: [
                        { candidateName: { contains: filters.search, mode: 'insensitive' } },
                        { email: { contains: filters.search, mode: 'insensitive' } },
                    ],
                }),
            },
            include: {
                enquiry: true,
                receipts: {
                    orderBy: { createdAt: 'desc' },
                },
                course: true,
            },
        });
        const pendingStudents = admissions
            .map((admission) => {
            const totalPaid = admission.receipts.reduce((sum, receipt) => decimal(sum).plus(receipt.amountCollected), decimal(0));
            const agentDiscount = admission.agentCommission || 0;
            // Calculate total fees from course instead of non-existent totalFees field
            const totalFees = decimal(admission.course.courseFee || 0).plus((admission.course.admissionFee || 0)).plus((admission.course.semesterFee || 0));
            const outstanding = decimal(totalFees).minus(totalPaid).minus(agentDiscount);
            const lastPayment = admission.receipts[0];
            if (decimal(outstanding).lessThanOrEqualTo(0))
                return null; // Fully paid
            const daysOverdue = admission.nextDueDate
                ? Math.max(0, Math.ceil((new Date().getTime() - new Date(admission.nextDueDate).getTime()) /
                    (1000 * 60 * 60 * 24)))
                : 0;
            let priority: 'high' | 'medium' | 'low';
            if (daysOverdue > 30)
                priority = 'high';
            else if (daysOverdue > 7)
                priority = 'medium';
            else
                priority = 'low';
            return {
                studentId: admission.enquiry?.id || admission.id,
                studentName: admission.candidateName,
                contactNumber: admission.enquiry?.candidateName || 'N/A', // Use candidateName as contact info isn't available in enquiry
                course: admission.course.name,
                outstandingAmount: outstanding,
                agentDiscount,
                daysOverdue,
                lastPaymentDate: lastPayment?.createdAt || null,
                nextDueDate: admission.nextDueDate || new Date(),
                priority,
            };
        })
            .filter(Boolean) as PendingPaymentDetails[];
        const totalOutstanding = pendingStudents.reduce((sum, student) => decimal(sum).plus(student.outstandingAmount), decimal(0));
        const totalStudents = pendingStudents.length;
        // Aging analysis
        const agingAnalysis = [
            {
                range: '0-7 days',
                count: pendingStudents.filter((s) => s.daysOverdue <= 7).length,
                amount: pendingStudents
                    .filter((s) => s.daysOverdue <= 7)
                    .reduce((sum, s) => decimal(sum).plus(s.outstandingAmount), decimal(0)),
            },
            {
                range: '8-30 days',
                count: pendingStudents.filter((s) => s.daysOverdue > 7 && s.daysOverdue <= 30).length,
                amount: pendingStudents
                    .filter((s) => s.daysOverdue > 7 && s.daysOverdue <= 30)
                    .reduce((sum, s) => decimal(sum).plus(s.outstandingAmount), decimal(0)),
            },
            {
                range: '30+ days',
                count: pendingStudents.filter((s) => s.daysOverdue > 30).length,
                amount: pendingStudents
                    .filter((s) => s.daysOverdue > 30)
                    .reduce((sum, s) => decimal(sum).plus(s.outstandingAmount), decimal(0)),
            },
        ];
        const report: PendingPaymentReport = {
            students: pendingStudents,
            totalOutstanding,
            totalStudents,
            agingAnalysis,
            collectionTargets: {
                thisWeek: decimal(totalOutstanding).times(0.1), // 10% target for this week
                thisMonth: decimal(totalOutstanding).times(0.3), // 30% target for this month
                thisQuarter: decimal(totalOutstanding).times(0.6), // 60% target for this quarter
            },
            filters,
        };
        return report;
    }
    const exportTelecallerReportCSVSchema = reportFiltersSchema;
    async function exportTelecallerReportCSV(input: unknown) {
        if (!["admin"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = exportTelecallerReportCSVSchema.parse(input ?? {}), ctx = { user: currentUser, userId: currentUser.id, userRole: currentUser.role, session: { id: currentUser.id, userId: currentUser.id } };
        const { userId, user } = ctx;
        const userRole = user.role || 'telecaller';
        const accessFilter = await getUserAccessibleData(userId, userRole);
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        // Get telecaller data for CSV
        const telecallers = await prisma.user.findMany({
            where: {
                role: 'telecaller',
                ...(userRole === 'telecaller' && { id: userId }),
            },
            include: {
                assignedEnquiries: {
                    where: {
                        ...accessFilter,
                        createdAt: dateFilter,
                    },
                    include: {
                        callLogs: true,
                        followUps: true,
                        admissions: true,
                    },
                },
            },
        });
        const csvData: CSVExportData = {
            filename: `telecaller-report-${formatDate(new Date())}.csv`,
            headers: [
                'Telecaller Name',
                'Total Enquiries',
                'Calls Made',
                'Conversions',
                'Conversion Rate (%)',
                'Average Call Duration (min)',
                'Follow-up Completion (%)',
                'Response Time (hrs)',
            ],
            rows: telecallers.map((telecaller) => {
                const enquiries = telecaller.assignedEnquiries;
                const totalEnquiries = enquiries.length;
                const callsMade = enquiries.reduce((sum, enq) => sum + enq.callLogs.length, 0);
                const conversions = enquiries.filter((enq) => enq.admissions.length > 0).length;
                const conversionRate = totalEnquiries > 0 ? (conversions / totalEnquiries) * 100 : 0;
                const totalFollowUps = enquiries.reduce((sum, enq) => sum + enq.followUps.length, 0);
                const completedFollowUps = enquiries.reduce((sum, enq) => sum + enq.followUps.filter((f) => f.status === 'COMPLETED').length, 0);
                const followUpCompletion = totalFollowUps > 0 ? (completedFollowUps / totalFollowUps) * 100 : 0;
                return [
                    telecaller.name || 'Unknown',
                    totalEnquiries.toString(),
                    callsMade.toString(),
                    conversions.toString(),
                    Math.round(conversionRate * 10) / 10 + '%',
                    '5.5', // Mock average call duration
                    Math.round(followUpCompletion * 10) / 10 + '%',
                    '2.5', // Mock response time
                ];
            }),
        };
        return csvData;
    }
    const exportFinancialReportCSVSchema = z.object({
        reportType: z.enum(['admission-payment', 'expense', 'invoice', 'income', 'pending-payment']),
        filters: reportFiltersSchema,
    });
    async function exportFinancialReportCSV(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const { reportType, filters } = exportFinancialReportCSVSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        let csvData: CSVExportData;
        const existingCourses = await prisma.course.findMany({
            select: { id: true },
        });
        console.log('type', reportType);
        const validCourseIds = existingCourses.map(c => c.id);
        switch (reportType) {
            case 'admission-payment':
                const admissions = await prisma.admission.findMany({
                    where: {
                        courseId: { in: validCourseIds },
                        createdAt: dateFilter,
                        ...(filters.search && {
                            OR: [
                                { candidateName: { contains: filters.search, mode: 'insensitive' } },
                                { email: { contains: filters.search, mode: 'insensitive' } },
                            ],
                        }),
                    },
                    include: {
                        receipts: true,
                        course: true,
                    },
                });
                csvData = {
                    filename: `admission-payment-report-${formatDate(new Date())}.csv`,
                    headers: [
                        'Student Name',
                        'Admission ID',
                        'Total Fees',
                        'Paid Amount',
                        'Outstanding',
                        'Agent Discount',
                        'Status',
                    ],
                    rows: admissions.map((admission) => {
                        const totalPaid = admission.receipts.reduce((sum, receipt) => decimal(sum).plus(receipt.amountCollected), decimal(0));
                        const agentDiscount = admission.agentCommission || 0;
                        const totalFees = decimal(admission.course.courseFee || 0).plus((admission.course.admissionFee || 0)).plus((admission.course.semesterFee || 0));
                        const outstanding = decimal(totalFees).minus(totalPaid).minus(agentDiscount);
                        let status: string;
                        if (decimal(outstanding).lessThanOrEqualTo(0))
                            status = 'fully_paid';
                        else if (decimal(totalPaid).greaterThan(0))
                            status = 'partially_paid';
                        else if (admission.nextDueDate && new Date(admission.nextDueDate) < new Date())
                            status = 'overdue';
                        else
                            status = 'pending';
                        return [
                            admission.candidateName,
                            admission.id,
                            formatCurrency(totalFees),
                            formatCurrency(totalPaid),
                            formatCurrency(outstanding),
                            formatCurrency(agentDiscount),
                            status,
                        ];
                    }),
                };
                break;
            case 'expense':
                const expenses = await prisma.expense.findMany({
                    where: {
                        expenseDate: dateFilter,
                        ...(filters.userId && { createdById: filters.userId }),
                    },
                });
                const categoryMap = expenses.reduce((acc, expense) => {
                    const category = expense.category;
                    if (!acc[category]) {
                        acc[category] = { totalAmount: decimal(0), transactionCount: 0 };
                    }
                    acc[category].totalAmount = decimal(acc[category].totalAmount).plus(expense.amount);
                    acc[category].transactionCount += 1;
                    return acc;
                }, {} as Record<string, {
                    totalAmount: Prisma.Decimal.Value;
                    transactionCount: number;
                }>);
                const totalAmount = expenses.reduce((sum, e) => decimal(sum).plus(e.amount), decimal(0));
                csvData = {
                    filename: `expense-report-${formatDate(new Date())}.csv`,
                    headers: ['Category', 'Total Amount', 'Transaction Count', 'Percentage'],
                    rows: Object.entries(categoryMap).map(([category, data]) => [
                        category,
                        formatCurrency(data.totalAmount),
                        data.transactionCount.toString(),
                        `${decimal(totalAmount).greaterThan(0) ? decimal(data.totalAmount).div(totalAmount).times(100).toDecimalPlaces(0) : 0}%`,
                    ]),
                };
                break;
            case 'pending-payment':
                const pendingAdmissions = await prisma.admission.findMany({
                    where: {
                        courseId: { in: validCourseIds },
                        ...(filters.search && {
                            OR: [
                                { candidateName: { contains: filters.search, mode: 'insensitive' } },
                                { email: { contains: filters.search, mode: 'insensitive' } },
                            ],
                        }),
                    },
                    include: {
                        receipts: true,
                        course: true,
                    },
                });
                const pendingStudents = pendingAdmissions
                    .map((admission) => {
                    const totalPaid = admission.receipts.reduce((sum, receipt) => decimal(sum).plus(receipt.amountCollected), decimal(0));
                    const totalFees = decimal(admission.course.courseFee || 0).plus((admission.course.admissionFee || 0)).plus((admission.course.semesterFee || 0));
                    const agentDiscount = admission.agentCommission || 0;
                    const outstanding = decimal(totalFees).minus(totalPaid).minus(agentDiscount);
                    if (decimal(outstanding).lessThanOrEqualTo(0))
                        return null;
                    const daysOverdue = admission.nextDueDate
                        ? Math.max(0, Math.ceil((new Date().getTime() - new Date(admission.nextDueDate).getTime()) /
                            (1000 * 60 * 60 * 24)))
                        : 0;
                    let priority: string;
                    if (daysOverdue > 30)
                        priority = 'high';
                    else if (daysOverdue > 7)
                        priority = 'medium';
                    else
                        priority = 'low';
                    return [
                        admission.candidateName,
                        admission.course.name,
                        formatCurrency(outstanding),
                        formatCurrency(agentDiscount),
                        daysOverdue.toString(),
                        priority,
                    ];
                })
                    .filter(Boolean) as string[][];
                csvData = {
                    filename: `pending-payment-report-${formatDate(new Date())}.csv`,
                    headers: ['Student Name', 'Course', 'Outstanding Amount', 'Agent Discount', 'Days Overdue', 'Priority'],
                    rows: pendingStudents,
                };
                break;
            default:
                throw new Error('Invalid report type');
        }
        console.log('csv data', csvData);
        return csvData;
    }
    const getReportDashboardDataSchema = z.object({});
    async function getReportDashboardData(input: unknown) {
        getReportDashboardDataSchema.parse(input ?? {});
        const ctx = { user: currentUser, userId: currentUser.id, userRole: currentUser.role, session: { id: currentUser.id, userId: currentUser.id } };
        const { userId, user } = ctx;
        const userRole = user.role || 'telecaller';
        const userBranch = user.branch || undefined;
        const cacheKey = `reports:summary:${userRole}:${userBranch || userId || 'all'}`;
        try {
            return await cacheService.getOrSet(cacheKey, CACHE_TTL.DASHBOARD, async () => {
                return await withPrismaRetry(async () => {
                    let totalEnquiries = 0;
                    let totalAdmissions = 0;
                    let invoiceRevenue = decimal(0);
                    let admissionRevenue = decimal(0);
                    let totalExpensesAmount = decimal(0);
                    try {
                        const rawResult: any[] = await prisma.$queryRawUnsafe(`
              SELECT
                (SELECT COUNT(*)::int FROM "enquiry") as "totalEnquiries",
                (SELECT COUNT(*)::int FROM "admission") as "totalAdmissions",
                (SELECT COALESCE(SUM("totalAmount"), 0) FROM "invoice" WHERE status = 'PAID') as "invoiceRevenue",
                (SELECT COALESCE(SUM("amountCollected"), 0) FROM "receipt") as "receiptRevenue",
                (SELECT COALESCE(SUM("amount"), 0) FROM "expense") as "totalExpenses"
            `);
                        const row = rawResult[0] || {};
                        totalEnquiries = Number(row.totalEnquiries) || 0;
                        totalAdmissions = Number(row.totalAdmissions) || 0;
                        invoiceRevenue = decimal(row.invoiceRevenue);
                        admissionRevenue = decimal(row.receiptRevenue);
                        totalExpensesAmount = decimal(row.totalExpenses);
                    }
                    catch (rawErr) {
                        console.warn('[Reports] Notice during aggregated query, falling back to safe counts:', rawErr);
                        totalEnquiries = await prisma.enquiry.count().catch(() => 0);
                        totalAdmissions = await prisma.admission.count().catch(() => 0);
                    }
                    const totalRevenue = decimal(invoiceRevenue).plus(admissionRevenue);
                    const dashboardData: ReportDashboardData = {
                        summaryCards: [
                            {
                                title: 'Total Enquiries',
                                value: totalEnquiries,
                                trend: { value: '+12%', type: 'up' },
                                icon: 'Users',
                                color: 'blue',
                            },
                            {
                                title: 'Total Admissions',
                                value: totalAdmissions,
                                trend: { value: '+8%', type: 'up' },
                                icon: 'UserCheck',
                                color: 'green',
                            },
                            {
                                title: 'Total Revenue',
                                value: formatCurrency(totalRevenue),
                                trend: { value: '+15%', type: 'up' },
                                icon: 'TrendingUp',
                                color: 'emerald',
                            },
                            {
                                title: 'Total Expenses',
                                value: formatCurrency(totalExpensesAmount),
                                trend: { value: '-5%', type: 'down' },
                                icon: 'TrendingDown',
                                color: 'red',
                            },
                        ],
                        availableReports: [
                            {
                                type: 'telecaller' as ReportType,
                                title: 'Telecaller Performance',
                                description: 'Individual telecaller performance metrics and statistics',
                                canAccess: true,
                            },
                            {
                                type: 'branch' as ReportType,
                                title: 'Branch Performance',
                                description: 'Branch-wise performance comparison and analysis',
                                canAccess: true,
                            },
                            {
                                type: 'admission-payment' as ReportType,
                                title: 'Admission Payments',
                                description: 'Student payment tracking and outstanding balances',
                                canAccess: true,
                            },
                            {
                                type: 'expense' as ReportType,
                                title: 'Expense Analysis',
                                description: 'Expense breakdown and category analysis',
                                canAccess: true,
                            },
                        ],
                        recentActivity: [],
                    };
                    return dashboardData;
                }, 2, 400);
            });
        }
        catch (err: any) {
            console.warn('[Reports] Notice in getReportDashboardData, returning default summary:', err?.message || err);
            return {
                summaryCards: [
                    { title: 'Total Enquiries', value: 0, trend: { value: '0%', type: 'up' }, icon: 'Users', color: 'blue' },
                    { title: 'Total Admissions', value: 0, trend: { value: '0%', type: 'up' }, icon: 'UserCheck', color: 'green' },
                    { title: 'Total Revenue', value: '₹0', trend: { value: '0%', type: 'up' }, icon: 'TrendingUp', color: 'emerald' },
                    { title: 'Total Expenses', value: '₹0', trend: { value: '0%', type: 'down' }, icon: 'TrendingDown', color: 'red' },
                ],
                availableReports: [],
                recentActivity: [],
            };
        }
    }
    const getBranchReportSchema = reportFiltersSchema;
    async function getBranchReport(input: unknown) {
        if (!["admin", "executive"].includes(currentUser.role || ''))
            throw new ForbiddenError('Insufficient permissions');
        const filters = getBranchReportSchema.parse(input ?? {});
        const dateFilter = await getDateRangeFilter(filters.dateRange);
        // Get all branches with their related data
        const branches = await prisma.branch.findMany({
            where: {
                isActive: true,
                ...(filters.search && {
                    name: { contains: filters.search, mode: 'insensitive' },
                }),
            },
            include: {
                enquiries: {
                    where: {
                        createdAt: dateFilter,
                        ...(filters.search && {
                            candidateName: { contains: filters.search, mode: 'insensitive' },
                        }),
                    },
                    include: {
                        preferredCourse: true,
                        admissions: {
                            include: {
                                receipts: {
                                    where: {
                                        paymentDate: dateFilter, // Filter receipts by payment date within the date range
                                    },
                                },
                                course: true,
                            },
                        },
                    },
                },
            },
        });
        // Note: Invoices are not directly linked to branches in this business model
        // Revenue comes from admission receipts which are linked to enquiries and branches
        // Calculate branch performance metrics
        const branchPerformance = branches.map((branch) => {
            const enquiries = branch.enquiries;
            const admissions = enquiries.flatMap((e) => e.admissions);
            const totalEnquiries = enquiries.length;
            const totalAdmissions = admissions.length;
            const conversionRate = totalEnquiries > 0 ? (totalAdmissions / totalEnquiries) * 100 : 0;
            // Calculate revenue from admission receipts (only real revenue)
            const totalRevenue = admissions.reduce((sum, admission) => {
                const paidAmount = admission.receipts.reduce((receiptSum, receipt) => decimal(receiptSum).plus(receipt.amountCollected), decimal(0));
                return decimal(sum).plus(paidAmount);
            }, decimal(0));
            const activeStudents = admissions.filter((a) => a.status === 'CONFIRMED' || a.status === 'COMPLETED').length;
            const averageEnquiryValue = totalEnquiries > 0 ? decimal(totalRevenue).div(totalEnquiries) : 0;
            return {
                branchId: branch.id,
                branchName: branch.name,
                totalEnquiries,
                totalAdmissions,
                conversionRate: Math.round(conversionRate * 10) / 10,
                totalRevenue: decimal(totalRevenue).toDecimalPlaces(0),
                activeStudents,
                averageEnquiryValue: decimal(averageEnquiryValue).toDecimalPlaces(0),
                period: filters.dateRange || { from: new Date(), to: new Date() },
            };
        });
        // Calculate enquiry distribution
        const enquiryDistribution = branches.map((branch) => {
            const enquiries = branch.enquiries;
            const totalEnquiries = branches.reduce((sum, b) => sum + b.enquiries.length, 0);
            const percentage = totalEnquiries > 0 ? Math.round((enquiries.length / totalEnquiries) * 100) : 0;
            // Get course preferences for this branch
            const coursePreferences = enquiries.reduce((acc, enquiry) => {
                if (enquiry.preferredCourseId) {
                    const existing = acc.find((cp) => cp.courseId === enquiry.preferredCourseId);
                    if (existing) {
                        existing.count += 1;
                    }
                    else {
                        acc.push({
                            courseId: enquiry.preferredCourseId,
                            courseName: enquiry.preferredCourse?.name || 'Unknown Course',
                            count: 1,
                        });
                    }
                }
                return acc;
            }, [] as Array<{
                courseId: string;
                courseName: string;
                count: number;
            }>);
            return {
                branchId: branch.id,
                branchName: branch.name,
                enquiryCount: enquiries.length,
                percentage,
                coursePreferences,
            };
        });
        // Find top performing branch (by revenue, then by conversion rate)
        const topPerformingBranch = branchPerformance.length > 0
            ? branchPerformance.reduce((prev, current) => {
                if (decimal(current.totalRevenue).greaterThan(prev.totalRevenue))
                    return current;
                if (decimal(current.totalRevenue).equals(prev.totalRevenue) &&
                    current.conversionRate > prev.conversionRate)
                    return current;
                return prev;
            }).branchName
            : 'None';
        const report: BranchReport = {
            performance: branchPerformance,
            enquiryDistribution,
            totalBranches: branches.length,
            topPerformingBranch,
            filters,
        };
        return report;
    }
    function getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            NEW: '#3B82F6',
            CONTACTED: '#F59E0B',
            CONFIRMED: '#10B981',
            NOT_INTERESTED: '#6B7280',
            FOLLOW_UP: '#8B5CF6',
            DROPPED: '#DC2626',
            INVALID: '#9CA3AF',
        };
        return colors[status] || '#6B7280';
    }
    return { getTelecallerPerformanceReport, getTelecallerEnquiryStats, getTelecallerConversionRates, getBranchPerformanceReport, getBranchAdmissionStats, getAdmissionPaymentReport, getExpenseReport, getInvoiceReport, getIncomeReport, getPendingPaymentReport, exportTelecallerReportCSV, exportFinancialReportCSV, getReportDashboardData, getBranchReport };
}
