
const { createClient } = require('redis');

async function checkRedis() {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  await client.connect();
  
  const allIds = await client.sMembers('devices:all');
  console.log('Devices in Redis (devices:all):', allIds);
  
  for (const id of allIds) {
    const data = await client.hGetAll(`device:${id}`);
    console.log(`Data for ${id}:`, Object.keys(data).length > 0 ? 'Found' : 'Empty');
  }
  
  await client.disconnect();
}

checkRedis().catch(console.error);
