import type { PrismaClient } from '@prisma/client';
import type { WorkflowUser } from './workflow-user.js';
import { withPrismaRetry } from './database-retry.js';
import { DashboardData } from './support/types/dashboard.js';
import { cacheService } from './support/lib/cache/cache-service.js';
import { CACHE_KEYS, CACHE_TTL } from './support/lib/cache/cache-keys.js';
export function createDashboardService(prisma: PrismaClient, _currentUser: WorkflowUser) {
    async function getDashboardData(userId?: string, userRole?: string, userBranch?: string): Promise<DashboardData> {
        // Determine isolated cache scope
        let scope = 'admin';
        if (userRole === 'telecaller' && userId) {
            scope = `telecaller:${userId}`;
        }
        else if (userRole === 'executive' && userBranch) {
            scope = `executive:${userBranch}`;
        }
        const cacheKey = CACHE_KEYS.dashboardSummary(scope);
        try {
            return await cacheService.getOrSet(cacheKey, CACHE_TTL.DASHBOARD, async () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                // Get the date 7 days ago for recent activity
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                let metrics = {
                    totalEnquiries: 0,
                    newEnquiries: 0,
                    interestedLeads: 0,
                    enrolledEnquiries: 0,
                    totalCalls: 0,
                    recentCallLogs: 0,
                    overdueFollowUps: 0,
                    todayFollowUps: 0,
                };
                try {
                    metrics = await withPrismaRetry(async () => {
                        let rawResult: any[] = [];
                        if (userRole === 'telecaller' && userId) {
                            rawResult = await prisma.$queryRawUnsafe(`
              SELECT
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "assignedToUserId" = $1) as "totalEnquiries",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "assignedToUserId" = $1 AND "createdAt" >= $2) as "newEnquiries",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "assignedToUserId" = $1 AND "status" = 'CONFIRMED') as "interestedLeads",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "assignedToUserId" = $1 AND "status" = 'CONFIRMED' AND "updatedAt" >= $2) as "enrolledEnquiries",
                (SELECT COUNT(*)::int FROM "call_log" WHERE "enquiryId" IN (SELECT id FROM "enquiry" WHERE "assignedToUserId" = $1)) as "totalCalls",
                (SELECT COUNT(*)::int FROM "call_log" WHERE "createdAt" >= $2 AND "enquiryId" IN (SELECT id FROM "enquiry" WHERE "assignedToUserId" = $1)) as "recentCallLogs",
                (SELECT COUNT(*)::int FROM "follow_up" WHERE "status" = 'PENDING' AND "scheduledAt" < $3 AND "enquiryId" IN (SELECT id FROM "enquiry" WHERE "assignedToUserId" = $1)) as "overdueFollowUps",
                (SELECT COUNT(*)::int FROM "follow_up" WHERE "status" = 'PENDING' AND "scheduledAt" >= $3 AND "scheduledAt" < $4 AND "enquiryId" IN (SELECT id FROM "enquiry" WHERE "assignedToUserId" = $1)) as "todayFollowUps"
            `, userId, sevenDaysAgo, today, tomorrow);
                        }
                        else if (userRole === 'executive' && userBranch) {
                            rawResult = await prisma.$queryRawUnsafe(`
              SELECT
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "branchId" = $1) as "totalEnquiries",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "branchId" = $1 AND "createdAt" >= $2) as "newEnquiries",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "branchId" = $1 AND "status" = 'CONFIRMED') as "interestedLeads",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "branchId" = $1 AND "status" = 'CONFIRMED' AND "updatedAt" >= $2) as "enrolledEnquiries",
                (SELECT COUNT(*)::int FROM "call_log" WHERE "enquiryId" IN (SELECT id FROM "enquiry" WHERE "branchId" = $1)) as "totalCalls",
                (SELECT COUNT(*)::int FROM "call_log" WHERE "createdAt" >= $2 AND "enquiryId" IN (SELECT id FROM "enquiry" WHERE "branchId" = $1)) as "recentCallLogs",
                (SELECT COUNT(*)::int FROM "follow_up" WHERE "status" = 'PENDING' AND "scheduledAt" < $3 AND "enquiryId" IN (SELECT id FROM "enquiry" WHERE "branchId" = $1)) as "overdueFollowUps",
                (SELECT COUNT(*)::int FROM "follow_up" WHERE "status" = 'PENDING' AND "scheduledAt" >= $3 AND "scheduledAt" < $4 AND "enquiryId" IN (SELECT id FROM "enquiry" WHERE "branchId" = $1)) as "todayFollowUps"
            `, userBranch, sevenDaysAgo, today, tomorrow);
                        }
                        else {
                            rawResult = await prisma.$queryRawUnsafe(`
              SELECT
                (SELECT COUNT(*)::int FROM "enquiry") as "totalEnquiries",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "createdAt" >= $1) as "newEnquiries",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "status" = 'CONFIRMED') as "interestedLeads",
                (SELECT COUNT(*)::int FROM "enquiry" WHERE "status" = 'CONFIRMED' AND "updatedAt" >= $1) as "enrolledEnquiries",
                (SELECT COUNT(*)::int FROM "call_log") as "totalCalls",
                (SELECT COUNT(*)::int FROM "call_log" WHERE "createdAt" >= $1) as "recentCallLogs",
                (SELECT COUNT(*)::int FROM "follow_up" WHERE "status" = 'PENDING' AND "scheduledAt" < $2) as "overdueFollowUps",
                (SELECT COUNT(*)::int FROM "follow_up" WHERE "status" = 'PENDING' AND "scheduledAt" >= $2 AND "scheduledAt" < $3) as "todayFollowUps"
            `, sevenDaysAgo, today, tomorrow);
                        }
                        const row = rawResult[0] || {};
                        return {
                            totalEnquiries: Number(row.totalEnquiries) || 0,
                            newEnquiries: Number(row.newEnquiries) || 0,
                            interestedLeads: Number(row.interestedLeads) || 0,
                            enrolledEnquiries: Number(row.enrolledEnquiries) || 0,
                            totalCalls: Number(row.totalCalls) || 0,
                            recentCallLogs: Number(row.recentCallLogs) || 0,
                            overdueFollowUps: Number(row.overdueFollowUps) || 0,
                            todayFollowUps: Number(row.todayFollowUps) || 0,
                        };
                    }, 2, 400);
                }
                catch (sqlErr: any) {
                    console.warn('[Dashboard] Aggregated metrics notice, using safe fallback values:', sqlErr?.message || sqlErr);
                }
                const { totalEnquiries, newEnquiries: newEnquiriesCount, interestedLeads, enrolledEnquiries, totalCalls, recentCallLogs, overdueFollowUps, todayFollowUps, } = metrics;
                // Calculate performance metrics
                const interestRate = totalEnquiries > 0 ? (interestedLeads / totalEnquiries) * 100 : 0;
                const conversionRate = totalEnquiries > 0 ? (enrolledEnquiries / totalEnquiries) * 100 : 0;
                return {
                    stats: {
                        totalEnquiries,
                        newEnquiries: newEnquiriesCount,
                        pendingFollowUps: overdueFollowUps + todayFollowUps,
                        totalCalls,
                    },
                    followUpStats: {
                        overdueCount: overdueFollowUps,
                        todayCount: todayFollowUps,
                        interestedLeadsCount: interestedLeads,
                    },
                    recentActivity: {
                        newEnquiries: {
                            count: newEnquiriesCount,
                            description: `${newEnquiriesCount} new leads`,
                        },
                        callsMade: {
                            count: recentCallLogs,
                            description: `${recentCallLogs} calls completed`,
                        },
                        enrollments: {
                            count: enrolledEnquiries,
                            description: `${enrolledEnquiries} successful conversions`,
                        },
                    },
                    performanceMetrics: {
                        totalEnquiries,
                        interestRate: Math.round(interestRate),
                        conversionRate: Math.round(conversionRate),
                        totalCalls,
                    },
                };
            });
        }
        catch (error: any) {
            console.warn('[Dashboard] Transient DB connection notice, returning fallback metrics:', error?.message || error);
            return {
                stats: {
                    totalEnquiries: 0,
                    newEnquiries: 0,
                    pendingFollowUps: 0,
                    totalCalls: 0,
                },
                followUpStats: {
                    overdueCount: 0,
                    todayCount: 0,
                    interestedLeadsCount: 0,
                },
                recentActivity: {
                    newEnquiries: { count: 0, description: '0 new leads' },
                    callsMade: { count: 0, description: '0 calls completed' },
                    enrollments: { count: 0, description: '0 successful conversions' },
                },
                performanceMetrics: {
                    totalEnquiries: 0,
                    interestRate: 0,
                    conversionRate: 0,
                    totalCalls: 0,
                },
            };
        }
    }
    return { getDashboardData };
}
