import type { Prisma } from '@prisma/client';
export interface ReportsStats {
  totalEnquiries: {
    count: number;
    trend: {
      value: string;
      type: 'up' | 'down';
    };
  };
  newEnquiries: {
    count: number;
    trend: {
      value: string;
      type: 'up' | 'down';
    };
  };
  pendingFollowUps: {
    count: number;
    trend: {
      value: string;
      type: 'up' | 'down';
    };
  };
  todaysCalls: {
    count: number;
    trend: {
      value: string;
      type: 'up' | 'down';
    };
  };
}

export interface EnquiryStatusDistribution {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface MonthlyTrend {
  month: string;
  count: number;
}

export interface ReportsData {
  stats: ReportsStats;
  statusDistribution: EnquiryStatusDistribution[];
  monthlyTrend: MonthlyTrend[];
}

// ✅ NEW ENHANCED TYPES FOR ADVANCED REPORTING SYSTEM

// === COMMON REPORT INTERFACES ===
export interface DateRangeFilter {
  from: Date;
  to: Date;
}

export interface ReportFilters {
  dateRange?: DateRangeFilter;
  branchId?: string;
  courseId?: string;
  userId?: string;
  status?: string;
  search?: string;
}

export interface CSVRow {
  [key: string]: string | number | Date | null;
}

export interface CSVExportData {
  filename: string;
  headers: string[];
  rows: string[][];
}

export interface ExportableReport {
  exportToCSV: () => Promise<CSVExportData>;
}

export interface ReportExportOptions {
  includeHeaders?: boolean;
  dateFormat?: string;
  currencyFormat?: string;
  excludeColumns?: string[];
}

// === TELECALLER REPORT TYPES ===
export interface TelecallerPerformanceMetrics {
  telecallerId: string;
  telecallerName: string;
  totalEnquiries: number;
  callsMade: number;
  conversions: number;
  conversionRate: number;
  averageCallDuration: number;
  followUpCompletion: number;
  responseTime: number; // in hours
  period: DateRangeFilter;
}

export interface TelecallerEnquiryStats {
  telecallerId: string;
  telecallerName: string;
  newEnquiries: number;
  contactedEnquiries: number;
  interestedEnquiries: number;
  enrolledEnquiries: number;
  droppedEnquiries: number;
  statusDistribution: EnquiryStatusDistribution[];
}

export interface TelecallerReport {
  performance: TelecallerPerformanceMetrics[];
  enquiryStats: TelecallerEnquiryStats[];
  totalTelecallers: number;
  topPerformer: string;
  filters: ReportFilters;
}

// === BRANCH REPORT TYPES ===
export interface BranchPerformanceMetrics {
  branchId: string;
  branchName: string;
  totalEnquiries: number;
  totalAdmissions: number;
  conversionRate: number;
  totalRevenue: Prisma.Decimal.Value;
  activeStudents: number;
  averageEnquiryValue: Prisma.Decimal.Value;
  period: DateRangeFilter;
}

export interface BranchEnquiryDistribution {
  branchId: string;
  branchName: string;
  enquiryCount: number;
  percentage: number;
  coursePreferences: {
    courseId: string;
    courseName: string;
    count: number;
  }[];
}

export interface BranchReport {
  performance: BranchPerformanceMetrics[];
  enquiryDistribution: BranchEnquiryDistribution[];
  totalBranches: number;
  topPerformingBranch: string;
  filters: ReportFilters;
}

// === FINANCIAL REPORT TYPES ===
export interface AdmissionPaymentDetails {
  studentId: string;
  studentName: string;
  admissionId: string;
  totalFees: Prisma.Decimal.Value;
  paidAmount: Prisma.Decimal.Value;
  agentDiscount: Prisma.Decimal.Value;
  outstandingAmount: Prisma.Decimal.Value;
  nextDueDate: Date | null;
  paymentHistory: {
    receiptNumber: string;
    amount: Prisma.Decimal.Value;
    paymentDate: Date;
    paymentMode: string;
  }[];
  status: 'fully_paid' | 'partially_paid' | 'overdue' | 'pending';
}

export interface AdmissionPaymentReport {
  students: AdmissionPaymentDetails[];
  totalCollected: Prisma.Decimal.Value;
  totalOutstanding: Prisma.Decimal.Value;
  totalOverdue: Prisma.Decimal.Value;
  paymentModeBreakdown: {
    mode: string;
    amount: Prisma.Decimal.Value;
    count: number;
  }[];
  filters: ReportFilters;
}

export interface ExpenseBreakdown {
  categoryId: string;
  categoryName: string;
  totalAmount: Prisma.Decimal.Value;
  transactionCount: number;
  percentage: number;
  monthlyTrend: {
    month: string;
    amount: Prisma.Decimal.Value;
  }[];
}

export interface ExpenseReport {
  breakdown: ExpenseBreakdown[];
  totalExpenses: Prisma.Decimal.Value;
  topCategory: string;
  monthlyTrend: MonthlyTrend[];
  userWiseExpenses: {
    userId: string;
    userName: string;
    totalAmount: Prisma.Decimal.Value;
    transactionCount: number;
  }[];
  filters: ReportFilters;
}

export interface InvoiceStatusBreakdown {
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  count: number;
  totalAmount: Prisma.Decimal.Value;
  percentage: number;
}

export interface InvoiceReport {
  statusBreakdown: InvoiceStatusBreakdown[];
  totalRevenue: Prisma.Decimal.Value;
  outstandingAmount: Prisma.Decimal.Value;
  averageCollectionTime: number; // in days
  paymentTimeline: {
    period: string;
    collected: Prisma.Decimal.Value;
    pending: Prisma.Decimal.Value;
  }[];
  agingAnalysis: {
    range: string; // e.g., "0-30 days", "31-60 days"
    count: number;
    amount: Prisma.Decimal.Value;
  }[];
  filters: ReportFilters;
}

export interface IncomeSource {
  source: string;
  amount: Prisma.Decimal.Value;
  percentage: number;
  transactionCount: number;
}

export interface IncomeReport {
  totalIncome: Prisma.Decimal.Value;
  sources: IncomeSource[];
  monthlyRevenue: {
    month: string;
    amount: Prisma.Decimal.Value;
    growth: number; // percentage growth from previous month
    invoiceCount?: number;
  }[];
  paymentMethodDistribution: {
    method: string;
    amount: Prisma.Decimal.Value;
    percentage: number;
  }[];
  detailedTransactions?: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    description: string;
    amount: Prisma.Decimal.Value;
    date: Date;
    itemCount: number;
    category: string;
  }[];
  filters: ReportFilters;
}

export interface PendingPaymentDetails {
  studentId: string;
  studentName: string;
  contactNumber: string;
  course: string;
  outstandingAmount: Prisma.Decimal.Value;
  agentDiscount: Prisma.Decimal.Value;
  daysOverdue: number;
  lastPaymentDate: Date | null;
  nextDueDate: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface PendingPaymentReport {
  students: PendingPaymentDetails[];
  totalOutstanding: Prisma.Decimal.Value;
  totalStudents: number;
  agingAnalysis: {
    range: string;
    count: number;
    amount: Prisma.Decimal.Value;
  }[];
  collectionTargets: {
    thisWeek: Prisma.Decimal.Value;
    thisMonth: Prisma.Decimal.Value;
    thisQuarter: Prisma.Decimal.Value;
  };
  filters: ReportFilters;
}

// === UNIFIED REPORT TYPES ===
export type ReportType =
  | 'telecaller'
  | 'branch'
  | 'admission-payment'
  | 'expense'
  | 'invoice'
  | 'income'
  | 'pending-payment';

export interface BaseReport {
  type: ReportType;
  title: string;
  description: string;
  generatedAt: Date;
  generatedBy: string;
  filters: ReportFilters;
}

export type AllReports =
  | (TelecallerReport & BaseReport)
  | (BranchReport & BaseReport)
  | (AdmissionPaymentReport & BaseReport)
  | (ExpenseReport & BaseReport)
  | (InvoiceReport & BaseReport)
  | (IncomeReport & BaseReport)
  | (PendingPaymentReport & BaseReport);

// === REPORT GENERATION OPTIONS ===
export interface ReportGenerationOptions {
  filters: ReportFilters;
  exportFormat?: 'csv' | 'pdf';
  includeCharts?: boolean;
  groupBy?: 'day' | 'week' | 'month' | 'quarter';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// === DASHBOARD SUMMARY TYPES ===
export interface ReportSummaryCard {
  title: string;
  value: string | number;
  trend?: {
    value: string;
    type: 'up' | 'down' | 'neutral';
  };
  icon: string;
  color: string;
}

export interface ReportDashboardData {
  summaryCards: ReportSummaryCard[];
  availableReports: {
    type: ReportType;
    title: string;
    description: string;
    lastGenerated?: Date;
    canAccess: boolean;
  }[];
  recentActivity: {
    action: string;
    user: string;
    timestamp: Date;
    reportType: ReportType;
  }[];
}
