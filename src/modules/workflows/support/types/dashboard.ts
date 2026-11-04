export interface DashboardStats {
  totalEnquiries: number;
  newEnquiries: number;
  pendingFollowUps: number;
  totalCalls: number;
}

export interface FollowUpStats {
  overdueCount: number;
  todayCount: number;
  interestedLeadsCount: number;
}

export interface RecentActivity {
  newEnquiries: {
    count: number;
    description: string;
  };
  callsMade: {
    count: number;
    description: string;
  };
  enrollments: {
    count: number;
    description: string;
  };
}

export interface PerformanceMetrics {
  totalEnquiries: number;
  interestRate: number;
  conversionRate: number;
  totalCalls: number;
}

export interface QuickAction {
  icon: unknown;
  label: string;
  href: string;
}

export interface DashboardData {
  stats: DashboardStats;
  followUpStats: FollowUpStats;
  recentActivity: RecentActivity;
  performanceMetrics: PerformanceMetrics;
}
