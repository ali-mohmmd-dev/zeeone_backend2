import { ForbiddenError } from '../../errors/app-error.js';
import type { WorkflowUser } from './workflow-user.js';
import { getUserEffectivePermissions } from './support/lib/permissions.js';

export function requireWorkflowAccess(user: WorkflowUser, module: string, operation: string) {
  const start = performance.now();
  try {
    const role = (user.role || '').toLowerCase();
    if (role === 'admin') return;

    if (module === 'auth') {
      if (['updateProfileAction', 'changePasswordAction', 'getAllBranches', 'getAllRoles'].includes(operation)) return;
      throw new ForbiddenError('Administrator access required');
    }
    if (module === 'data-management') {
      if (operation.startsWith('get')) return;
      throw new ForbiddenError('Administrator access required');
    }
    if (module === 'notification' || operation === 'getCurrentUser') return;
    if (module === 'enquiry-action' && operation.startsWith('get')) return;

    const features: Record<string, string[]> = {
      'admission-actions': ['projects'],
      'call-log': ['call_register', 'enquiries', 'job_orders'],
      'enquiry': ['enquiries', 'job_orders'],
      'enquiry-activity-actions': ['enquiries', 'job_orders'],
      'enquiry-status-actions': ['enquiries', 'job_orders'],
      'expense-actions': ['expenses'],
      'fee-collection-actions': ['projects', 'invoices'],
      'follow-up': ['follow_ups', 'enquiries', 'job_orders'],
      'invoice-actions': ['invoices'],
      'invoice-catalog-actions': ['invoices'],
      'job-order': ['job_orders', 'enquiries'],
      'proposal-proposal-actions': ['proposals', 'invoices'],
      'receipt-actions': ['projects', 'invoices'],
      'report-actions': ['reports'],
      'reports': ['reports'],
      'service-actions': ['services', 'projects'],
      'dashboard': ['dashboard'],
    };
    const permissions = user.permissions ?? getUserEffectivePermissions(user);

    if (permissions.includes('*') || permissions.includes('all')) return;
    if (features[module]?.some(feature => permissions.includes(feature))) return;
    throw new ForbiddenError('Access denied');
  } finally {
    const elapsed = performance.now() - start;
    console.log(`[WorkflowAccess] ${module}:${operation} checked in ${elapsed.toFixed(3)}ms`);
  }
}
