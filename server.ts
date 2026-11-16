import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getAppVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
    return String(pkg.version || '1.1.0');
  } catch {
    return '1.1.0';
  }
}

interface SyncClientMeta {
  role: 'panel' | 'display';
  clientId: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  let latestPresentationPayload: unknown = null;
  let latestSettingsPayload: unknown = null;
  let latestFontsPayload: unknown = null;
  const clientMeta = new Map<WebSocket, SyncClientMeta>();

  function broadcastPresence() {
    let displayCount = 0;
    let panelCount = 0;
    for (const meta of clientMeta.values()) {
      if (meta.role === 'display') displayCount += 1;
      else panelCount += 1;
    }
    const msg = JSON.stringify({
      type: 'presence',
      connectedDisplays: displayCount,
      connectedPanels: panelCount,
      timestamp: Date.now(),
    });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  wss.on('connection', (ws) => {
    clientMeta.set(ws, { role: 'panel', clientId: 'unknown' });

    if (latestPresentationPayload) {
      ws.send(JSON.stringify({ type: 'presentation:update', payload: latestPresentationPayload }));
    }
    if (latestSettingsPayload) {
      ws.send(JSON.stringify({ type: 'settings:update', payload: latestSettingsPayload }));
    }
    if (latestFontsPayload) {
      ws.send(JSON.stringify({ type: 'fonts:update', payload: latestFontsPayload }));
    }

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === 'register') {
          clientMeta.set(ws, {
            role: parsed.role === 'display' ? 'display' : 'panel',
            clientId: String(parsed.clientId || 'unknown'),
          });
          broadcastPresence();
          if (latestPresentationPayload) {
            ws.send(JSON.stringify({ type: 'presentation:update', payload: latestPresentationPayload }));
          }
          if (latestSettingsPayload) {
            ws.send(JSON.stringify({ type: 'settings:update', payload: latestSettingsPayload }));
          }
          if (latestFontsPayload) {
            ws.send(JSON.stringify({ type: 'fonts:update', payload: latestFontsPayload }));
          }
          return;
        }

        if (parsed.type === 'presentation:update') {
          latestPresentationPayload = parsed.payload;
        } else if (parsed.type === 'settings:update') {
          latestSettingsPayload = parsed.payload;
        } else if (parsed.type === 'fonts:update') {
          latestFontsPayload = parsed.payload;
        } else if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        const out = JSON.stringify(parsed);
        for (const client of wss.clients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(out);
          }
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      clientMeta.delete(ws);
      broadcastPresence();
    });
  });

  app.get('/api/health', (_req, res) => {
    let displayCount = 0;
    for (const meta of clientMeta.values()) {
      if (meta.role === 'display') displayCount += 1;
    }
    res.json({
      ok: true,
      service: 'ET BSP',
      version: getAppVersion(),
      connectedDisplays: displayCount,
    });
  });

  app.get('/api/version', (_req, res) => {
    res.json({
      app: 'ET BSP',
      version: getAppVersion(),
      timestamp: Date.now(),
    });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ET BSP server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ET BSP server:', err);
  process.exit(1);
});
