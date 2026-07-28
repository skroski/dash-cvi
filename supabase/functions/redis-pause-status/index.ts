// Supabase Edge Function: redis-pause-status
// Connects to Redis and returns all _block keys with their stored timestamps
// Runs on Deno (supabase edge runtime), uses native TCP via redis deno client

import { connect } from "https://deno.land/x/redis@v0.32.1/mod.ts";

const REDIS_HOST = Deno.env.get("REDIS_HOST") || "redis-17099.crce181.sa-east-1-2.ec2.cloud.redislabs.com";
const REDIS_PORT = parseInt(Deno.env.get("REDIS_PORT") || "17099");
const REDIS_PASSWORD = Deno.env.get("REDIS_PASSWORD") || "qNJZyFrgTuVRQ2AMATxbKu9r6ZFzBE3i";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const redis = await connect({
      hostname: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      tls: true,
    });

    // Get all keys matching the _block pattern
    const keys = await redis.keys("*@s.whatsapp.net_block");

    const result: Record<string, { value: string | null; ttl: number }> = {};

    for (const key of keys) {
      const value = await redis.get(key);
      const ttl = await redis.ttl(key); // -1 = no expiry, -2 = key gone, >= 0 = seconds remaining

      // Extract phone number: "5511234567890@s.whatsapp.net_block" -> "5511234567890"
      const phone = key.replace("@s.whatsapp.net_block", "");
      result[phone] = { value, ttl };
    }

    await redis.quit();

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Redis connection error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
