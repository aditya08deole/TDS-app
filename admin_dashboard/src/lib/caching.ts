/**
 * Advanced caching and request deduplication service
 * Fix #8: Reduce redundant API calls through smart caching strategies
 *
 * Implements:
 * - Request deduplication (in-flight request tracking)
 * - Stale-While-Revalidate (SWR) pattern
 * - Aggressive caching with TTL per endpoint
 * - Smart prefetching based on user navigation
 */

import { storage } from './storage';

// In-flight request tracking to deduplicate concurrent requests
const inflightRequests = new Map<string, Promise<any>>();

// Cache with TTL per endpoint
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();

/**
 * Get cache TTL by endpoint (in milliseconds)
 * More frequently changing data has shorter TTL
 */
function getCacheTTL(endpoint: string): number {
  // Dashboard stats: 1 minute (high frequency)
  if (endpoint.includes('/stats')) return 60 * 1000;
  
  // Device data: 5 minutes (medium frequency)
  if (endpoint.includes('/devices')) return 5 * 60 * 1000;
  
  // Sensor data: 3 minutes (medium frequency)
  if (endpoint.includes('/sensor-data')) return 3 * 60 * 1000;
  
  // Alerts: 1 minute (high priority)
  if (endpoint.includes('/alerts')) return 60 * 1000;
  
  // Health events: 5 minutes (low frequency)
  if (endpoint.includes('/health')) return 5 * 60 * 1000;
  
  // Default: 10 minutes
  return 10 * 60 * 1000;
}

/**
 * Get cached data if still valid (not expired)
 */
function getCached<T>(endpoint: string): T | null {
  const entry = cacheStore.get(endpoint);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    // Expired - remove from cache
    cacheStore.delete(endpoint);
    return null;
  }
  
  return entry.data as T;
}

/**
 * Store data in cache with TTL
 */
function setCached<T>(endpoint: string, data: T): void {
  cacheStore.set(endpoint, {
    data,
    timestamp: Date.now(),
    ttl: getCacheTTL(endpoint),
  });
}

/**
 * Deduplicated fetch with in-flight request tracking
 *
 * If a request is already in-flight, return that promise instead of making a duplicate call.
 * This prevents stampede of identical concurrent requests.
 *
 * @param endpoint - API endpoint (used as dedup key)
 * @param fetchFn - Function that performs the actual fetch
 * @param options - { bypassCache: boolean, useSwrPattern: boolean }
 */
export async function dedupFetch<T>(
  endpoint: string,
  fetchFn: () => Promise<T>,
  options: { bypassCache?: boolean; useSwrPattern?: boolean } = {}
): Promise<T> {
  const { bypassCache = false, useSwrPattern = true } = options;

  // Check if request is already in-flight
  if (inflightRequests.has(endpoint)) {
    console.log(`[DEDUP] Reusing in-flight request: ${endpoint}`);
    return inflightRequests.get(endpoint)!;
  }

  // Check cache first (if not bypassed)
  if (!bypassCache) {
    const cached = getCached<T>(endpoint);
    if (cached) {
      console.log(`[CACHE-HIT] ${endpoint}`);
      
      // SWR pattern: return cached data immediately, refetch in background
      if (useSwrPattern) {
        console.log(`[SWR] Starting background refresh for: ${endpoint}`);
        // Start background refresh without awaiting
        dedupFetch(endpoint, fetchFn, { bypassCache: true, useSwrPattern: false })
          .catch(err => console.error(`[SWR-ERROR] Failed to refresh ${endpoint}:`, err));
      }
      
      return cached;
    }
  }

  // Create the fetch promise
  const fetchPromise = (async () => {
    try {
      const data = await fetchFn();
      setCached(endpoint, data);
      return data;
    } catch (error) {
      // Cache error responses with shorter TTL (10 seconds) to prevent request stampede
      // but not too long to keep stale errors
      if (error instanceof Error) {
        setCached(endpoint, { __error: true, message: error.message, timestamp: Date.now() } as any);
      }
      throw error;
    } finally {
      // Remove from in-flight tracking
      inflightRequests.delete(endpoint);
    }
  })();

  // Track as in-flight
  inflightRequests.set(endpoint, fetchPromise);

  return fetchPromise;
}

/**
 * Batch requests together to reduce total API calls
 * Useful for fetching multiple resources that could be combined
 *
 * @param requests - Array of { endpoint, fetchFn } pairs
 */
export async function batchFetch<T>(
  requests: Array<{ endpoint: string; fetchFn: () => Promise<any> }>
): Promise<T[]> {
  console.log(`[BATCH] Fetching ${requests.length} endpoints together`);
  
  return Promise.all(
    requests.map(({ endpoint, fetchFn }) =>
      dedupFetch(endpoint, fetchFn)
    )
  );
}

/**
 * Clear cache for specific endpoint(s)
 * Useful after mutations that invalidate data
 */
export function invalidateCache(pattern?: string | RegExp): void {
  if (!pattern) {
    cacheStore.clear();
    console.log('[CACHE] Cleared all cache');
    return;
  }

  const isRegex = pattern instanceof RegExp;
  for (const [key] of cacheStore) {
    const shouldDelete = isRegex ? pattern.test(key) : key.includes(pattern as string);
    if (shouldDelete) {
      cacheStore.delete(key);
      console.log(`[CACHE] Invalidated: ${key}`);
    }
  }
}

/**
 * Prefetch data before user navigates to page
 * Call on hover/route prediction to warm up cache
 */
export async function prefetch(endpoint: string, fetchFn: () => Promise<any>): Promise<void> {
  const cached = getCached(endpoint);
  if (cached) {
    console.log(`[PREFETCH] Already cached: ${endpoint}`);
    return;
  }

  console.log(`[PREFETCH] Warming cache: ${endpoint}`);
  await dedupFetch(endpoint, fetchFn, { useSwrPattern: false });
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): {
  totalCached: number;
  endpoints: Array<{ endpoint: string; age: number; ttl: number; fresh: boolean }>;
} {
  const endpoints = Array.from(cacheStore.entries()).map(([endpoint, entry]) => {
    const age = Date.now() - entry.timestamp;
    return {
      endpoint,
      age,
      ttl: entry.ttl,
      fresh: age < entry.ttl,
    };
  });

  return {
    totalCached: endpoints.length,
    endpoints,
  };
}

/**
 * Export cache stats to debug storage
 */
export async function exportCacheStats(): Promise<void> {
  const stats = getCacheStats();
  await storage.set('cache_stats', JSON.stringify(stats, null, 2));
  console.log('[CACHE-STATS]', stats);
}

/**
 * Monitor cache memory usage
 */
export function getCacheMemoryUsage(): {
  estimatedBytes: number;
  estimatedMB: number;
} {
  let bytes = 0;
  for (const [key, value] of cacheStore) {
    bytes += key.length * 2; // Rough estimate for key
    bytes += JSON.stringify(value.data).length * 2; // Rough estimate for data
  }

  return {
    estimatedBytes: bytes,
    estimatedMB: bytes / (1024 * 1024),
  };
}

/**
 * Clear cache if it exceeds size limit (50 MB default)
 */
export function enforceMemoryLimit(maxMB: number = 50): void {
  const { estimatedMB } = getCacheMemoryUsage();
  
  if (estimatedMB > maxMB) {
    console.warn(`[CACHE] Memory limit exceeded (${estimatedMB.toFixed(2)} MB / ${maxMB} MB)`);
    
    // Clear oldest entries first
    const sorted = Array.from(cacheStore.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    while (getCacheMemoryUsage().estimatedMB > maxMB * 0.8 && cacheStore.size > 0) {
      const [oldestKey] = sorted.shift()!;
      cacheStore.delete(oldestKey);
      console.log(`[CACHE] Evicted: ${oldestKey}`);
    }
  }
}

// Network State Management for SWR Pattern
// ISSUE-010: Handle online/offline events to pause/resume background refreshes
let isOnlineMode = true;
const swrPausedRequests = new Set<string>();

/**
 * Initialize network state listener
 * Pauses background SWR refreshes when offline, resumes when online
 */
export function initNetworkStateListener(): void {
  // Check initial state
  isOnlineMode = navigator.onLine;
  console.log(`[NETWORK] Initialized: ${isOnlineMode ? 'Online' : 'Offline'}`);

  // Listen for online event
  window.addEventListener('online', () => {
    console.log('[NETWORK] Back online - resuming background refreshes');
    isOnlineMode = true;
    // Resume any paused SWR requests
    swrPausedRequests.forEach(endpoint => {
      console.log(`[NETWORK-RESUME] Resuming SWR for ${endpoint}`);
    });
    swrPausedRequests.clear();
  });

  // Listen for offline event
  window.addEventListener('offline', () => {
    console.log('[NETWORK] Went offline - pausing background refreshes');
    isOnlineMode = false;
  });
}

/**
 * Check if app is in online mode
 */
export function isOnline(): boolean {
  return isOnlineMode;
}

/**
 * Check if SWR background refresh should proceed
 */
export function shouldSWR(endpoint: string): boolean {
  if (!isOnlineMode) {
    console.log(`[SWR-PAUSED] Skipped background refresh for ${endpoint} (offline)`);
    swrPausedRequests.add(endpoint);
    return false;
  }
  return true;
}

// Initialize network listener on module load
if (typeof window !== 'undefined') {
  initNetworkStateListener();
}

/**
 * Enable periodic cache cleanup (runs in background)
 */
export function enableCacheCleanup(intervalMs: number = 5 * 60 * 1000): void {
  setInterval(() => {
    const stats = getCacheStats();
    const staleCount = stats.endpoints.filter(e => !e.fresh).length;
    
    if (staleCount > 0) {
      console.log(`[CACHE-CLEANUP] Removing ${staleCount} stale entries`);
      invalidateCache();
    }
    
    enforceMemoryLimit();
  }, intervalMs);
}

// Auto-cleanup every 5 minutes
enableCacheCleanup();

export default {
  dedupFetch,
  batchFetch,
  invalidateCache,
  prefetch,
  getCacheStats,
  exportCacheStats,
  getCacheMemoryUsage,
  enforceMemoryLimit,
};
