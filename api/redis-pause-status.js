// Vercel Serverless Function: /api/redis-pause-status
// Connects to Redis (no TLS) and returns all *@s.whatsapp.net_block keys + TTL

import { createClient } from 'redis';

// Redis does NOT use TLS — use redis:// (not rediss://)
const REDIS_URL = `redis://:${
  process.env.REDIS_PASSWORD || 'qNJZyFrgTuVRQ2AMATxbKu9r6ZFzBE3i'
}@${
  process.env.REDIS_HOST || 'redis-17099.crce181.sa-east-1-2.ec2.cloud.redislabs.com'
}:${
  process.env.REDIS_PORT || '17099'
}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const client = createClient({ url: REDIS_URL });

  try {
    await client.connect();

    // Match pattern: "5511XXXXXXXXX@s.whatsapp.net_block"
    const keys = await client.keys('*@s.whatsapp.net_block');

    const data = {};

    await Promise.all(
      keys.map(async (key) => {
        const ttl = await client.ttl(key);

        // Extract phone digits only from "5511XXXXX@s.whatsapp.net_block"
        // → strips "@s.whatsapp.net_block" → "5511XXXXX"
        const phone = key.replace('@s.whatsapp.net_block', '');

        // Value is always "true" — presence of key means paused
        // TTL: -1 = indefinite pause, -2 = expired/gone, >= 0 = seconds remaining
        data[phone] = { ttl };
      })
    );

    await client.disconnect();

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[redis-pause-status] Error:', error);
    try { await client.disconnect(); } catch {}
    return res.status(500).json({ success: false, error: String(error) });
  }
}
