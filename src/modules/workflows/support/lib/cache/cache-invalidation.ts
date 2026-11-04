/**
 * Centralized Cache Invalidation Helpers
 * Phase 8: Cache Invalidation & Consistency Hardening
 * Prevents scattering raw string keys and guarantees scope-correct cache purges
 */

import { cacheService } from './cache-service.js';
import { CACHE_KEYS } from './cache-keys.js';

export type MasterDataEntity =
  | 'branches'
  | 'courses'
  | 'services'
  | 'sources'
  | 'roles'
  | 'settings';

/**
 * Invalidate dashboard caches.
 * If scope is provided (e.g. 'admin', 'telecaller:123', 'executive:branchA'), invalidates that scope.
 * If no scope is provided, invalidates ALL dashboard caches across all scopes.
 */
export async function invalidateDashboardCache(scope?: string): Promise<void> {
  try {
    if (scope) {
      await cacheService.delete(CACHE_KEYS.dashboardSummary(scope));
    } else {
      await cacheService.deleteByPrefix(CACHE_KEYS.dashboardPrefix);
    }
  } catch (err) {
    console.warn('[invalidateDashboardCache] Error:', err);
  }
}

/**
 * Invalidate a specific master-data cache without affecting other master-data entries.
 */
export async function invalidateMasterDataCache(entity: MasterDataEntity): Promise<void> {
  try {
    switch (entity) {
      case 'branches':
        await cacheService.delete(CACHE_KEYS.branches);
        break;
      case 'courses':
        await cacheService.delete(CACHE_KEYS.courses);
        await cacheService.delete(`${CACHE_KEYS.courses}:active`);
        break;
      case 'services':
        await cacheService.delete(CACHE_KEYS.services);
        break;
      case 'sources':
        await cacheService.delete(CACHE_KEYS.sources);
        break;
      case 'roles':
        await cacheService.delete('crm:master-data:roles');
        break;
      case 'settings':
        await cacheService.delete(CACHE_KEYS.settings);
        break;
    }
  } catch (err) {
    console.warn(`[invalidateMasterDataCache] Error invalidating ${entity}:`, err);
  }
}

/**
 * Invalidate cached user permissions.
 * If userId is provided, invalidates that user's permission cache.
 * If no userId is provided, invalidates all permission caches.
 */
export async function invalidateUserPermissionCache(userId?: string): Promise<void> {
  try {
    if (userId) {
      await cacheService.delete(CACHE_KEYS.userPermissions(userId));
    } else {
      await cacheService.deleteByPrefix(CACHE_KEYS.permissionsPrefix);
    }
  } catch (err) {
    console.warn('[invalidateUserPermissionCache] Error:', err);
  }
}

/**
 * Invalidate all CRM caches (system maintenance / emergency purge).
 */
export async function invalidateAllCaches(): Promise<void> {
  try {
    await cacheService.clear();
  } catch (err) {
    console.warn('[invalidateAllCaches] Error:', err);
  }
}
