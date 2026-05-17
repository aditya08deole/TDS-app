import { createClient } from 'redis';

type RedisLike = {
  ping(): Promise<string>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string>;
  exists(key: string): Promise<number>;
  del(key: string): Promise<number>;
  hSet(key: string, data: Record<string, string>): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
  sAdd(key: string, ...members: string[]): Promise<number>;
  sRem(key: string, ...members: string[]): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  sCard(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  lPush(key: string, ...values: string[]): Promise<number>;
  rPush(key: string, ...values: string[]): Promise<number>;
  lLen(key: string): Promise<number>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  lTrim(key: string, start: number, stop: number): Promise<'OK'>;
  incr(key: string): Promise<number>;
  quit(): Promise<'OK'>;
  multi(): any;
  on?(event: string, handler: (...args: any[]) => void): void;
};

let client: any = null;

const memoryStrings = new Map<string, string>();
const memoryHashes = new Map<string, Map<string, string>>();
const memorySets = new Map<string, Set<string>>();
const memoryLists = new Map<string, string[]>();

function createMemoryRedis(): RedisLike {
  return {
    async ping() {
      return 'PONG';
    },
    async get(key: string) {
      return memoryStrings.has(key) ? memoryStrings.get(key)! : null;
    },
    async set(key: string, value: string) {
      memoryStrings.set(key, value);
      return 'OK';
    },
    async exists(key: string) {
      return memoryStrings.has(key) || memoryHashes.has(key) || memorySets.has(key) || memoryLists.has(key) ? 1 : 0;
    },
    async del(key: string) {
      let removed = 0;
      if (memoryStrings.delete(key)) removed += 1;
      if (memoryHashes.delete(key)) removed += 1;
      if (memorySets.delete(key)) removed += 1;
      if (memoryLists.delete(key)) removed += 1;
      return removed;
    },
    async hSet(key: string, data: Record<string, string>) {
      const hash = memoryHashes.get(key) || new Map<string, string>();
      let changed = 0;
      for (const [field, value] of Object.entries(data)) {
        if (hash.get(field) !== value) changed += 1;
        hash.set(field, value);
      }
      memoryHashes.set(key, hash);
      return changed;
    },
    async hGetAll(key: string) {
      const hash = memoryHashes.get(key);
      return hash ? Object.fromEntries(hash.entries()) : {};
    },
    async sAdd(key: string, ...members: string[]) {
      const set = memorySets.get(key) || new Set<string>();
      const before = set.size;
      members.forEach(member => set.add(member));
      memorySets.set(key, set);
      return set.size - before;
    },
    async sRem(key: string, ...members: string[]) {
      const set = memorySets.get(key);
      if (!set) return 0;
      let removed = 0;
      members.forEach(member => {
        if (set.delete(member)) removed += 1;
      });
      return removed;
    },
    async sMembers(key: string) {
      return Array.from(memorySets.get(key) || []);
    },
    async sCard(key: string) {
      return (memorySets.get(key) || new Set()).size;
    },
    async expire(key: string, seconds: number) {
      return true; // Mocked success
    },
    async lPush(key: string, ...values: string[]) {
      const list = memoryLists.get(key) || [];
      list.unshift(...values);
      memoryLists.set(key, list);
      return list.length;
    },
    async rPush(key: string, ...values: string[]) {
      const list = memoryLists.get(key) || [];
      list.push(...values);
      memoryLists.set(key, list);
      return list.length;
    },
    async lLen(key: string) {
      return (memoryLists.get(key) || []).length;
    },
    async lRange(key: string, start: number, stop: number) {
      const list = memoryLists.get(key) || [];
      const from = start < 0 ? Math.max(list.length + start, 0) : start;
      const to = stop < 0 ? list.length : stop + 1;
      return list.slice(from, to);
    },
    async lTrim(key: string, start: number, stop: number) {
      const list = memoryLists.get(key) || [];
      const from = start < 0 ? Math.max(list.length + start, 0) : start;
      const to = stop < 0 ? list.length : stop + 1;
      memoryLists.set(key, list.slice(from, to));
      return 'OK';
    },
    async incr(key: string) {
      const val = parseInt(memoryStrings.get(key) || '0', 10) + 1;
      memoryStrings.set(key, String(val));
      return val;
    },
    async quit() {
      return 'OK';
    },
    multi() {
      // Return a proxy or a simple object that maps to the existing methods
      const self = this as any;
      const batch = {
        sAdd: (key: string, ...members: string[]) => {
          self.sAdd(key, ...members);
          return batch;
        },
        expire: (key: string, seconds: number) => {
          self.expire(key, seconds);
          return batch;
        },
        exec: async () => {
          return [];
        }
      };
      return batch;
    },
  };
}

export async function initializeRedis(): Promise<any> {
  if (client) return client;

  if (process.env.REDIS_URL?.startsWith('memory://') || process.env.DISABLE_REDIS === 'true') {
    console.log('🧠 Using in-memory Redis fallback');
    client = createMemoryRedis();
    return client;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`🔌 Connecting to Redis at ${redisUrl}...`);

  client = createClient({
    url: redisUrl,
  });

  client.on('error', (err: unknown) => console.error('❌ Redis Client Error', err));
  client.on('connect', () => console.log('✅ Redis Client Connected'));

  try {
    await client.connect();
  } catch (error) {
    console.warn('⚠️ Redis unavailable, using in-memory fallback for local dev');
    client = createMemoryRedis();
  }

  return client;
}

export function getRedisClient(): any {
  if (!client) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

/**
 * Helper to store a hash with a specific key
 */
export async function hset(key: string, data: Record<string, any>): Promise<void> {
  const redis = getRedisClient();
  const stringifiedData: Record<string, string> = {};
  
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    stringifiedData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }

  if (Object.keys(stringifiedData).length > 0) {
    await redis.hSet(key, stringifiedData);
  }
}

/**
 * Helper to get a hash and parse it
 */
export async function hgetall<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  const data = await redis.hGetAll(key);
  
  if (!data || Object.keys(data).length === 0) return null;

  const parsedData: any = {};
  for (const [k, v] of Object.entries(data)) {
    try {
      parsedData[k] = JSON.parse(v as string);
    } catch {
      parsedData[k] = v;
    }
  }

  return parsedData as T;
}
