/**
 * L1 Cache: In-memory store for high-frequency data
 * Used to reduce Redis hits for extremely frequent lookups
 */

type CacheEntry<T> = {
    value: T;
    expiry: number;
};

class LocalCache {
    private store: Map<string, CacheEntry<any>> = new Map();
    private defaultTtl: number = 60 * 1000; // 1 minute default

    /**
     * Set a value in cache
     */
    set<T>(key: string, value: T, ttlMs?: number): void {
        const expiry = Date.now() + (ttlMs || this.defaultTtl);
        this.store.set(key, { value, expiry });
    }

    /**
     * Get a value from cache
     */
    get<T>(key: string): T | null {
        const entry = this.store.get(key);
        
        if (!entry) return null;
        
        if (Date.now() > entry.expiry) {
            this.store.delete(key);
            return null;
        }
        
        return entry.value as T;
    }

    /**
     * Remove a value from cache
     */
    del(key: string): void {
        this.store.delete(key);
    }

    /**
     * Clear all expired entries
     */
    prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiry) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.store.clear();
    }
}

// Singleton instance
export const l1Cache = new LocalCache();

// Periodically prune expired entries
setInterval(() => l1Cache.prune(), 5 * 60 * 1000); // Every 5 minutes

export default l1Cache;
