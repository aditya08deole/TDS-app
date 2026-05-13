import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export async function initializeRedis(): Promise<RedisClientType> {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`🔌 Connecting to Redis at ${redisUrl}...`);

  client = createClient({
    url: redisUrl,
  });

  client.on('error', (err) => console.error('❌ Redis Client Error', err));
  client.on('connect', () => console.log('✅ Redis Client Connected'));

  await client.connect();

  return client;
}

export function getRedisClient(): RedisClientType {
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
      parsedData[k] = JSON.parse(v);
    } catch {
      parsedData[k] = v;
    }
  }

  return parsedData as T;
}
