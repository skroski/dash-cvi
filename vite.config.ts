import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Replica em dev a função serverless api/redis-pause-status.js (Vercel),
// que só existe no ambiente de deploy. Sem isso, /api/redis-pause-status
// dá 404 em `npm run dev` e o badge de "Bot pausado" nunca aparece.
function redisPauseStatusDevMiddleware(): Plugin {
  return {
    name: 'redis-pause-status-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/redis-pause-status', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
          return;
        }

        const { createClient } = await import('redis');
        const REDIS_URL = `redis://:${
          process.env.REDIS_PASSWORD || 'qNJZyFrgTuVRQ2AMATxbKu9r6ZFzBE3i'
        }@${
          process.env.REDIS_HOST || 'redis-17099.crce181.sa-east-1-2.ec2.cloud.redislabs.com'
        }:${
          process.env.REDIS_PORT || '17099'
        }`;

        const client = createClient({ url: REDIS_URL });
        try {
          await client.connect();
          const keys = await client.keys('*@s.whatsapp.net_block');
          const data: Record<string, { ttl: number }> = {};

          await Promise.all(
            keys.map(async (key) => {
              const ttl = await client.ttl(key);
              const phone = key.replace('@s.whatsapp.net_block', '');
              data[phone] = { ttl };
            })
          );

          await client.disconnect();
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data }));
        } catch (error) {
          try { await client.disconnect(); } catch { /* noop */ }
          console.error('[redis-pause-status dev middleware] Error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: String(error) }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'development' && redisPauseStatusDevMiddleware(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
