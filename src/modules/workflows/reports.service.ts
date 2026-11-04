import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { FollowUpStatus } from '@prisma/client';
import { ReportsData, EnquiryStatusDistribution, MonthlyTrend } from './support/types/reports.js';
export function createReportsService(prisma: PrismaClient, _currentUser: WorkflowUser) {
    async function getReportsData(userId?: string): Promise<ReportsData> {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            // Last week and last month dates
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            // Base filter for user-specific data (for telecallers)
            const userFilter = userId ? { assignedToUserId: userId } : {};
            // Get current stats
            const [totalEnquiries, totalEnquiriesLastMonth, newEnquiriesThisWeek, newEnquiriesLastWeek, pendingFollowUpsToday, pendingFollowUpsYesterday, callsToday, callsYesterday,] = await Promise.all([
                // Total enquiries
                prisma.enquiry.count({
                    where: userFilter,
                }),
                // Total enquiries last month
                prisma.enquiry.count({
                    where: {
                        ...userFilter,
                        createdAt: { lt: lastMonth },
                    },
                }),
                // New enquiries this week
                prisma.enquiry.count({
                    where: {
                        ...userFilter,
                        createdAt: { gte: lastWeek },
                    },
                }),
                // New enquiries last week
                prisma.enquiry.count({
                    where: {
                        ...userFilter,
                        createdAt: {
                            gte: new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000),
                            lt: lastWeek,
                        },
                    },
                }),
                // Pending follow-ups today
                prisma.followUp.count({
                    where: {
                        enquiry: userFilter,
                        status: FollowUpStatus.PENDING,
                        scheduledAt: {
                            gte: today,
                            lt: tomorrow,
                        },
                    },
                }),
                // Pending follow-ups yesterday
                prisma.followUp.count({
                    where: {
                        enquiry: userFilter,
                        status: FollowUpStatus.PENDING,
                        scheduledAt: {
                            gte: yesterday,
                            lt: today,
                        },
                    },
                }),
                // Calls today
                prisma.callLog.count({
                    where: {
                        enquiry: userFilter,
                        createdAt: {
                            gte: today,
                            lt: tomorrow,
                        },
                    },
                }),
                // Calls yesterday
                prisma.callLog.count({
                    where: {
                        enquiry: userFilter,
                        createdAt: {
                            gte: yesterday,
                            lt: today,
                        },
                    },
                }),
            ]);
            // Calculate trends
            const totalEnquiriesTrend = totalEnquiriesLastMonth > 0
                ? Math.round(((totalEnquiries - totalEnquiriesLastMonth) / totalEnquiriesLastMonth) * 100)
                : 0;
            const newEnquiriesTrend = newEnquiriesThisWeek - newEnquiriesLastWeek;
            const followUpsTrend = pendingFollowUpsToday - pendingFollowUpsYesterday;
            const callsTrend = callsToday - callsYesterday;
            // Get enquiry status distribution
            const statusCounts = await prisma.enquiry.groupBy({
                by: ['status'],
                where: userFilter,
                _count: {
                    id: true,
                },
            });
            const STATUS_COLORS: Record<string, string> = {
                NEW: '#3b82f6',
                CONTACTED: '#8b5cf6',
                CONFIRMED: '#10b981',
                NOT_INTERESTED: '#ef4444',
                FOLLOW_UP: '#f59e0b',
                DROPPED: '#6b7280',
                INVALID: '#9ca3af',
            };
            const statusDistribution: EnquiryStatusDistribution[] = statusCounts.map((item) => {
                const percentage = totalEnquiries > 0 ? Math.round((item._count.id / totalEnquiries) * 100) : 0;
                return {
                    status: item.status,
                    count: item._count.id,
                    percentage,
                    color: STATUS_COLORS[item.status] || '#6b7280',
                };
            });
            // Get monthly trend for the last 6 months
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            const monthlyData = await prisma.enquiry.groupBy({
                by: ['createdAt'],
                where: {
                    ...userFilter,
                    createdAt: {
                        gte: sixMonthsAgo,
                    },
                },
                _count: {
                    id: true,
                },
            });
            const monthlyTrend: MonthlyTrend[] = [];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const monthName = months[date.getMonth()];
                const count = monthlyData
                    .filter((item) => {
                    const itemDate = new Date(item.createdAt);
                    return (itemDate.getMonth() === date.getMonth() && itemDate.getFullYear() === date.getFullYear());
                })
                    .reduce((sum, item) => sum + item._count.id, 0);
                monthlyTrend.push({
                    month: monthName,
                    count,
                });
            }
            return {
                stats: {
                    totalEnquiries: {
                        count: totalEnquiries,
                        trend: {
                            value: `${totalEnquiriesTrend > 0 ? '+' : ''}${totalEnquiriesTrend}% from last month`,
                            type: totalEnquiriesTrend >= 0 ? 'up' : 'down',
                        },
                    },
                    newEnquiries: {
                        count: newEnquiriesThisWeek,
                        trend: {
                            value: `${newEnquiriesTrend > 0 ? '+' : ''}${newEnquiriesTrend} from last week`,
                            type: newEnquiriesTrend >= 0 ? 'up' : 'down',
                        },
                    },
                    pendingFollowUps: {
                        count: pendingFollowUpsToday,
                        trend: {
                            value: `${followUpsTrend > 0 ? '+' : ''}${Math.abs(followUpsTrend)} from yesterday`,
                            type: followUpsTrend <= 0 ? 'up' : 'down',
                        },
                    },
                    todaysCalls: {
                        count: callsToday,
                        trend: {
                            value: `${callsTrend > 0 ? '+' : ''}${callsTrend} from yesterday`,
                            type: callsTrend >= 0 ? 'up' : 'down',
                        },
                    },
                },
                statusDistribution,
                monthlyTrend,
            };
        }
        catch (error) {
            console.error('Failed to fetch reports data:', error);
            return {
                stats: {
                    totalEnquiries: { count: 0, trend: { value: '0% from last month', type: 'up' } },
                    newEnquiries: { count: 0, trend: { value: '0 from last week', type: 'up' } },
                    pendingFollowUps: { count: 0, trend: { value: '0 from yesterday', type: 'up' } },
                    todaysCalls: { count: 0, trend: { value: '0 from yesterday', type: 'up' } },
                },
                statusDistribution: [],
                monthlyTrend: [],
            };
        }
    }
    return { getReportsData };
}
