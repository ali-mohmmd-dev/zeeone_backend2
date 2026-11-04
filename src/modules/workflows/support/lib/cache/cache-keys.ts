/**
 * Centralized Cache Keys and Namespace Helpers
 * Phase 7: Application-Level In-Memory Caching
 */

export const CACHE_TTL = {
  DASHBOARD: 60, // 60 seconds
  MASTER_DATA: 600, // 10 minutes (600 seconds)
  PERMISSIONS: 300, // 5 minutes (300 seconds)
} as const;

export const CACHE_KEYS = {
  // Dashboard namespaces (strictly scoped to user/role/branch)
  dashboardSummary: (scope: string) => `crm:dashboard:summary:${scope}`,
  dashboardPrefix: 'crm:dashboard:summary:',

  // Master data namespaces
  branches: 'crm:master-data:branches',
  courses: 'crm:master-data:courses',
  services: 'crm:master-data:services',
  sources: 'crm:master-data:sources',
  settings: 'crm:master-data:settings',
  masterDataPrefix: 'crm:master-data:',

  // User permission namespaces
  userPermissions: (userId: string) => `crm:permissions:${userId}`,
  permissionsPrefix: 'crm:permissions:',
} as const;
