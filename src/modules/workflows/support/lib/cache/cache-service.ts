/**
 * Hardened In-Memory Cache Service
 * Phase 8: Cache Invalidation & Consistency Hardening
 * Features: True LRU Eviction, In-Flight SingleFlight Request Deduplication, Observability, Bulletproof Error Shielding
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number; // timestamp in ms
  createdAt: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  expired: number;
  errors: number;
  dedupedRequests: number;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): CacheStats;
}

class HardenedInMemoryCacheService implements ICacheService {
  private store: Map<string, CacheEntry<any>> = new Map();
  private inflightLoaders: Map<string, Promise<any>> = new Map();
  private maxEntries: number;
  
  // Observability metrics
  private hits: number = 0;
  private misses: number = 0;
  private sets: number = 0;
  private deletes: number = 0;
  private evictions: number = 0;
  private expired: number = 0;
  private errors: number = 0;
  private dedupedRequests: number = 0;

  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;

    // Periodic sweep every 30 seconds to clean expired items
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => {
        this.sweepExpired();
      }, 30000);
      if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref();
      }
    }
  }

  private sweepExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        this.expired++;
      }
    }
  }

  /**
   * Get an item from the cache.
   * Promotes the entry to the end of the Map to maintain true LRU (Least Recently Used) order.
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const entry = this.store.get(key);
      if (!entry) {
        this.misses++;
        return null;
      }

      if (entry.expiresAt <= Date.now()) {
        this.store.delete(key);
        this.misses++;
        this.expired++;
        return null;
      }

      // True LRU maintenance: delete and re-set moves the key to the back (most recently used)
      this.store.delete(key);
      this.store.set(key, entry);

      this.hits++;
      return entry.value as T;
    } catch (err) {
      console.warn(`[CacheService.get] Warning reading key "${key}":`, err);
      this.errors++;
      this.misses++;
      return null;
    }
  }

  /**
   * Set an item with TTL in seconds.
   * Evicts the true Least Recently Used entry if capacity is exceeded.
   */
  public async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      if (value === undefined) return;

      // If key already exists, delete first to refresh position
      if (this.store.has(key)) {
        this.store.delete(key);
      } else if (this.store.size >= this.maxEntries) {
        // Evict oldest (least recently used) entry
        const oldestKey = this.store.keys().next().value;
        if (oldestKey) {
          this.store.delete(oldestKey);
          this.evictions++;
        }
      }

      const now = Date.now();
      this.store.set(key, {
        value,
        createdAt: now,
        expiresAt: now + ttlSeconds * 1000,
      });
      this.sets++;
    } catch (err) {
      console.warn(`[CacheService.set] Warning writing key "${key}":`, err);
      this.errors++;
    }
  }

  /**
   * Get an existing item or compute it using loader with SingleFlight concurrent request deduplication.
   */
  public async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch (err) {
      console.warn(`[CacheService.getOrSet] Read error for "${key}":`, err);
      this.errors++;
    }

    // In-flight request deduplication (SingleFlight pattern)
    // If another request is currently executing the loader for the same key, join it.
    if (this.inflightLoaders.has(key)) {
      this.dedupedRequests++;
      return this.inflightLoaders.get(key) as Promise<T>;
    }

    const loaderPromise = (async () => {
      try {
        const freshValue = await loader();
        try {
          if (freshValue !== null && freshValue !== undefined) {
            await this.set(key, freshValue, ttlSeconds);
          }
        } catch (setErr) {
          console.warn(`[CacheService.getOrSet] Set error for "${key}":`, setErr);
          this.errors++;
        }
        return freshValue;
      } finally {
        this.inflightLoaders.delete(key);
      }
    })();

    this.inflightLoaders.set(key, loaderPromise);
    return loaderPromise;
  }

  public async delete(key: string): Promise<void> {
    try {
      if (this.store.delete(key)) {
        this.deletes++;
      }
    } catch (err) {
      console.warn(`[CacheService.delete] Warning deleting key "${key}":`, err);
      this.errors++;
    }
  }

  public async deleteByPrefix(prefix: string): Promise<void> {
    try {
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
          this.deletes++;
        }
      }
    } catch (err) {
      console.warn(`[CacheService.deleteByPrefix] Warning for prefix "${prefix}":`, err);
      this.errors++;
    }
  }

  public async clear(): Promise<void> {
    this.store.clear();
    this.inflightLoaders.clear();
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.deletes = 0;
    this.evictions = 0;
    this.expired = 0;
    this.errors = 0;
    this.dedupedRequests = 0;
  }

  public getStats(): CacheStats {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      evictions: this.evictions,
      expired: this.expired,
      errors: this.errors,
      dedupedRequests: this.dedupedRequests,
    };
  }
}

// Global persistent instance for Next.js development
const globalForCache = globalThis as unknown as { cacheService?: HardenedInMemoryCacheService };

export const cacheService: ICacheService =
  globalForCache.cacheService || new HardenedInMemoryCacheService();

if (process.env.NODE_ENV !== 'production') {
  globalForCache.cacheService = cacheService as HardenedInMemoryCacheService;
}
