// src/constants/permissions.ts

export type FeatureKey =
  | 'dashboard'
  | 'enquiries'
  | 'job_orders'
  | 'follow_ups'
  | 'call_register'
  | 'projects'
  | 'services'
  | 'proposals'
  | 'invoices'
  | 'expenses'
  | 'reports'
  | 'data_management'
  | 'users_management'
  | '*';

export interface FeatureModule {
  id: FeatureKey;
  label: string;
  description: string;
  category: 'core' | 'operations' | 'finance' | 'admin';
  defaultPath: string;
}

export const ALL_FEATURE_MODULES: FeatureModule[] = [
  // Core & Leads
  {
    id: 'dashboard',
    label: 'Dashboard Overview',
    description: 'Access main KPI metrics, activity overview, and performance summaries',
    category: 'core',
    defaultPath: '/dashboard',
  },
  {
    id: 'enquiries',
    label: 'Enquiries & Leads',
    description: 'Capture, manage, and assign customer solar enquiries and pipeline stages',
    category: 'core',
    defaultPath: '/enquiries',
  },
  {
    id: 'follow_ups',
    label: 'Follow-ups',
    description: 'Manage upcoming, today, and overdue customer interaction follow-ups',
    category: 'core',
    defaultPath: '/follow-ups',
  },
  {
    id: 'call_register',
    label: 'Call Register',
    description: 'View customer call history, durations, outcomes, and agent logs',
    category: 'core',
    defaultPath: '/call-register',
  },
  {
    id: 'proposals',
    label: 'Solar Proposals',
    description: 'Generate, manage, and review solar engineering quotations & proposals',
    category: 'core',
    defaultPath: '/proposals',
  },

  // Operations & Field
  {
    id: 'job_orders',
    label: 'Job Orders',
    description: 'Field engineer job allocations, pending tasks, and completed job orders',
    category: 'operations',
    defaultPath: '/enquiries/job-orders/pending',
  },
  {
    id: 'projects',
    label: 'Site Surveys & Projects',
    description: 'Site technical surveys, project admissions, and customer solar installations',
    category: 'operations',
    defaultPath: '/admissions',
  },
  {
    id: 'services',
    label: 'Service Billing & Maintenance',
    description: 'Customer solar servicing requests, maintenance tickets, and service bills',
    category: 'operations',
    defaultPath: '/services',
  },

  // Finance & Accounts
  {
    id: 'invoices',
    label: 'Invoices & Payments',
    description: 'Solar system package billing, customer payments, receipts, and PDF generation',
    category: 'finance',
    defaultPath: '/invoices',
  },
  {
    id: 'expenses',
    label: 'Expense Tracking',
    description: 'Business expenditure, office utilities, travel, and operational costs',
    category: 'finance',
    defaultPath: '/expenses',
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    description: 'Branch analytics, telecaller performance, revenue and payment tracking',
    category: 'finance',
    defaultPath: '/reports',
  },

  // Administration
  {
    id: 'data_management',
    label: 'Data Management',
    description: 'Required Capacities (solar packages), office branches, and enquiry sources',
    category: 'admin',
    defaultPath: '/admin/data-management',
  },
  {
    id: 'users_management',
    label: 'User & Access Control',
    description: 'Team member provisioning, software positions, and granular RBAC permissions',
    category: 'admin',
    defaultPath: '/admin/users',
  },
];

export interface SoftwarePositionDefinition {
  id: string; // internal role key / slug
  title: string;
  shortTitle: string;
  description: string;
  badgeStyle: string;
  defaultPermissions: FeatureKey[];
}

export const SOFTWARE_POSITIONS: SoftwarePositionDefinition[] = [
  {
    id: 'admin',
    title: 'Super Admin',
    shortTitle: 'Admin',
    description: 'Full unrestricted administrator access across all software modules and management controls',
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    defaultPermissions: ['*'],
  },
  {
    id: 'enquiries',
    title: 'Enquiries Specialist',
    shortTitle: 'Enquiries',
    description: 'Dedicated to customer lead generation, enquiry qualification, follow-ups, calls, and proposals',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    defaultPermissions: ['dashboard', 'enquiries', 'follow_ups', 'call_register', 'proposals'],
  },
  {
    id: 'job_orders',
    title: 'Job Orders & Field Operations',
    shortTitle: 'Job Orders',
    description: 'Field engineer managing site survey allocations, pending tasks, and completed job orders',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    defaultPermissions: ['dashboard', 'job_orders', 'projects'],
  },
  {
    id: 'services',
    title: 'Service Billing & Maintenance',
    shortTitle: 'Services',
    description: 'After-sales servicing, maintenance tickets, and service-only billing records',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    defaultPermissions: ['dashboard', 'services', 'projects'],
  },
  {
    id: 'accounts',
    title: 'Accounts & Invoicing',
    shortTitle: 'Accounts',
    description: 'Financial invoices, solar packages, payment collections, receipts, and expense tracking',
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
    defaultPermissions: ['dashboard', 'invoices', 'expenses', 'services', 'reports'],
  },
  {
    id: 'manager',
    title: 'Project & Branch Manager',
    shortTitle: 'Manager',
    description: 'Branch oversight: enquiries, job orders, surveys, proposals, and performance reports',
    badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
    defaultPermissions: ['dashboard', 'enquiries', 'job_orders', 'follow_ups', 'call_register', 'projects', 'proposals', 'reports'],
  },
  {
    id: 'telecaller',
    title: 'Telecaller / Sales Agent',
    shortTitle: 'Telecaller',
    description: 'Outbound sales calls, customer engagement, and scheduled lead follow-ups',
    badgeStyle: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800',
    defaultPermissions: ['dashboard', 'enquiries', 'follow_ups', 'call_register'],
  },
  {
    id: 'custom',
    title: 'Custom Feature-Based',
    shortTitle: 'Custom',
    description: 'Customized position with individual feature permissions tailored by the Administrator',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    defaultPermissions: ['dashboard'],
  },
];

// Helper mapping for legacy/fallback roles
export const DEFAULT_ROLE_PERMISSIONS_MAP: Record<string, FeatureKey[]> = {
  admin: ['*'],
  'super admin': ['*'],
  enquiries: ['dashboard', 'enquiries', 'follow_ups', 'call_register', 'proposals'],
  job_orders: ['dashboard', 'job_orders', 'projects'],
  joborders: ['dashboard', 'job_orders', 'projects'],
  services: ['dashboard', 'services', 'projects'],
  service: ['dashboard', 'services', 'projects'],
  accounts: ['dashboard', 'invoices', 'expenses', 'services', 'reports'],
  manager: ['dashboard', 'enquiries', 'job_orders', 'follow_ups', 'call_register', 'projects', 'proposals', 'reports'],
  telecaller: ['dashboard', 'enquiries', 'follow_ups', 'call_register'],
  counselor: ['dashboard', 'enquiries', 'follow_ups', 'call_register', 'proposals'],
  executive: ['dashboard', 'enquiries', 'projects', 'invoices', 'expenses'],
  custom: ['dashboard'],
};
