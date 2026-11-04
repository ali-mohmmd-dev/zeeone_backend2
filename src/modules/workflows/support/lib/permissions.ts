// src/lib/permissions.ts
import {
  ALL_FEATURE_MODULES,
  DEFAULT_ROLE_PERMISSIONS_MAP,
  FeatureKey,
  FeatureModule,
  SOFTWARE_POSITIONS,
  SoftwarePositionDefinition,
} from '../constants/permissions.js';

export interface UserPermissionContext {
  role?: string | null;
  permissions?: string[];
  userRole?: {
    id?: string;
    name?: string;
    permissions?: string[];
  } | null;
}

/**
 * Returns the resolved array of feature keys enabled for the user.
 */
export function getUserEffectivePermissions(user?: UserPermissionContext | null): string[] {
  if (!user) return [];

  // 0. If pre-resolved permissions already exist on the user, use them directly
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }

  const roleNormalized = (user.role || '').toLowerCase().trim();

  // Super Admin always has full access
  if (roleNormalized === 'admin' || roleNormalized === 'super admin') {
    return ['*'];
  }

  // 1. Explicit permissions from User's associated Role model in DB
  const roleRecordPermissions = user.userRole?.permissions;
  if (roleRecordPermissions && roleRecordPermissions.length > 0) {
    if (roleRecordPermissions.includes('*') || roleRecordPermissions.includes('all')) {
      return ['*'];
    }
    return roleRecordPermissions;
  }

  // 2. Check position definition by user.role
  const position = SOFTWARE_POSITIONS.find((p) => p.id === roleNormalized);
  if (position) {
    return position.defaultPermissions;
  }

  // 3. Fallback map for legacy roles (e.g. counselor, executive)
  if (DEFAULT_ROLE_PERMISSIONS_MAP[roleNormalized]) {
    return DEFAULT_ROLE_PERMISSIONS_MAP[roleNormalized];
  }

  return ['dashboard'];
}

/**
 * Checks if the user has access to a specific feature key.
 */
export function hasFeatureAccess(
  user: UserPermissionContext | null | undefined,
  featureKey: FeatureKey
): boolean {
  if (!user) return false;

  const permissions = user.permissions ?? getUserEffectivePermissions(user);

  if (permissions.includes('*') || permissions.includes('all')) {
    return true;
  }

  return permissions.includes(featureKey);
}

/**
 * Returns the matching Software Position definition, or a sensible fallback.
 */
export function getPositionDefinition(roleKeyOrName?: string | null): SoftwarePositionDefinition {
  const normalized = (roleKeyOrName || '').toLowerCase().trim();
  const match = SOFTWARE_POSITIONS.find(
    (p) => p.id === normalized || p.title.toLowerCase() === normalized
  );

  if (match) return match;

  return (
    SOFTWARE_POSITIONS.find((p) => p.id === 'custom') || {
      id: 'custom',
      title: 'Custom Position',
      shortTitle: 'Custom',
      description: 'Individual feature access tailored by administrator',
      badgeStyle: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
      defaultPermissions: ['dashboard'],
    }
  );
}

/**
 * Resolves the primary/first permitted route for a user upon login or redirection.
 */
export function getFirstPermittedPath(user?: UserPermissionContext | null): string {
  if (!user) return '/login';

  const permissions = user.permissions ?? getUserEffectivePermissions(user);

  if (permissions.includes('*') || permissions.includes('dashboard')) {
    return '/dashboard';
  }

  // Find the first module matching allowed permissions
  for (const module of ALL_FEATURE_MODULES) {
    if (permissions.includes(module.id)) {
      return module.defaultPath;
    }
  }

  return '/dashboard';
}

/**
 * Helper to get all modules grouped by category
 */
export function getFeatureModulesByCategory(): Record<
  FeatureModule['category'],
  FeatureModule[]
> {
  const grouped: Record<FeatureModule['category'], FeatureModule[]> = {
    core: [],
    operations: [],
    finance: [],
    admin: [],
  };

  for (const m of ALL_FEATURE_MODULES) {
    if (m.id !== '*') {
      grouped[m.category].push(m);
    }
  }

  return grouped;
}
