import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
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

const SERVER_BOOT_ID = `${getAppVersion()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const DATA_DIR = process.env.ETBSP_DATA_DIR || path.join(os.homedir(), '.etbsp');
const WORKSPACE_FILE = path.join(DATA_DIR, 'etbsp-workspace.json');

interface WorkspaceRecord {
  updatedAt?: number;
  translations?: unknown[];
  songs?: unknown[];
  customFonts?: unknown[];
  displaySettings?: unknown;
  themeSettings?: unknown;
  preferences?: unknown;
  presentationState?: unknown;
}

function readWorkspaceFromDisk(): WorkspaceRecord | null {
  try {
    if (!fs.existsSync(WORKSPACE_FILE)) return null;
    const raw = fs.readFileSync(WORKSPACE_FILE, 'utf8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as WorkspaceRecord) : null;
  } catch {
    return null;
  }
}

function writeWorkspaceToDisk(data: WorkspaceRecord): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpFile = `${WORKSPACE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf8');
    fs.renameSync(tmpFile, WORKSPACE_FILE);
  } catch (err) {
    console.error('Failed to persist ET BSP workspace:', err);
  }
}

function setNoCacheHeaders(res: express.Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

interface SyncClientMeta {
  role: 'panel' | 'display';
  clientId: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  let persistedWorkspace: WorkspaceRecord | null = readWorkspaceFromDisk();
  let latestPresentationPayload: unknown = persistedWorkspace?.presentationState || null;
  let latestSettingsPayload: unknown = persistedWorkspace?.displaySettings || null;
  let latestFontsPayload: unknown = persistedWorkspace?.customFonts || null;
  const clientMeta = new Map<WebSocket, SyncClientMeta>();

  function persistPartialWorkspace(patch: Partial<WorkspaceRecord>) {
    persistedWorkspace = {
      ...(persistedWorkspace || {}),
      ...patch,
      updatedAt: Date.now(),
    };
    writeWorkspaceToDisk(persistedWorkspace);
  }

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

  function sendHelloAndLatest(ws: WebSocket) {
    ws.send(
      JSON.stringify({
        type: 'server:hello',
        version: getAppVersion(),
        bootId: SERVER_BOOT_ID,
      })
    );
    if (latestPresentationPayload) {
      ws.send(JSON.stringify({ type: 'presentation:update', payload: latestPresentationPayload }));
    }
    if (latestSettingsPayload) {
      ws.send(JSON.stringify({ type: 'settings:update', payload: latestSettingsPayload }));
    }
    if (latestFontsPayload) {
      ws.send(JSON.stringify({ type: 'fonts:update', payload: latestFontsPayload }));
    }
  }

  wss.on('connection', (ws) => {
    clientMeta.set(ws, { role: 'panel', clientId: 'unknown' });
    sendHelloAndLatest(ws);

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === 'register') {
          clientMeta.set(ws, {
            role: parsed.role === 'display' ? 'display' : 'panel',
            clientId: String(parsed.clientId || 'unknown'),
          });
          broadcastPresence();
          sendHelloAndLatest(ws);
          return;
        }

        if (parsed.type === 'presentation:update') {
          latestPresentationPayload = parsed.payload;
          persistPartialWorkspace({ presentationState: parsed.payload });
        } else if (parsed.type === 'settings:update') {
          latestSettingsPayload = parsed.payload;
          persistPartialWorkspace({ displaySettings: parsed.payload });
        } else if (parsed.type === 'fonts:update') {
          latestFontsPayload = parsed.payload;
          persistPartialWorkspace({ customFonts: parsed.payload });
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
    setNoCacheHeaders(res);
    let displayCount = 0;
    for (const meta of clientMeta.values()) {
      if (meta.role === 'display') displayCount += 1;
    }
    res.json({
      ok: true,
      service: 'ET BSP',
      version: getAppVersion(),
      bootId: SERVER_BOOT_ID,
      connectedDisplays: displayCount,
    });
  });

  app.get('/api/version', (_req, res) => {
    setNoCacheHeaders(res);
    res.json({
      app: 'ET BSP',
      version: getAppVersion(),
      bootId: SERVER_BOOT_ID,
      timestamp: Date.now(),
    });
  });

  app.get('/api/workspace', (_req, res) => {
    setNoCacheHeaders(res);
    res.json({
      exists: Boolean(persistedWorkspace),
      bootId: SERVER_BOOT_ID,
      data: persistedWorkspace,
    });
  });

  app.get('/api/workspace/display', (_req, res) => {
    setNoCacheHeaders(res);
    res.json({
      bootId: SERVER_BOOT_ID,
      version: getAppVersion(),
      presentationState: latestPresentationPayload || persistedWorkspace?.presentationState || null,
      displaySettings: latestSettingsPayload || persistedWorkspace?.displaySettings || null,
      customFonts: latestFontsPayload || persistedWorkspace?.customFonts || null,
    });
  });

  app.put('/api/workspace', (req, res) => {
    setNoCacheHeaders(res);
    const body = req.body;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ ok: false, error: 'Invalid workspace payload' });
      return;
    }
    const patch: Partial<WorkspaceRecord> = {};
    if (Array.isArray(body.translations)) patch.translations = body.translations;
    if (Array.isArray(body.songs)) patch.songs = body.songs;
    if (Array.isArray(body.customFonts)) {
      patch.customFonts = body.customFonts;
      latestFontsPayload = body.customFonts;
    }
    if (body.displaySettings && typeof body.displaySettings === 'object') {
      patch.displaySettings = body.displaySettings;
      latestSettingsPayload = body.displaySettings;
    }
    if (body.themeSettings && typeof body.themeSettings === 'object') {
      patch.themeSettings = body.themeSettings;
    }
    if (body.preferences && typeof body.preferences === 'object') {
      patch.preferences = body.preferences;
    }
    if (body.presentationState && typeof body.presentationState === 'object') {
      patch.presentationState = body.presentationState;
      latestPresentationPayload = body.presentationState;
    }
    persistPartialWorkspace(patch);
    res.json({ ok: true, updatedAt: persistedWorkspace?.updatedAt || Date.now() });
  });

  app.delete('/api/workspace', (_req, res) => {
    setNoCacheHeaders(res);
    persistedWorkspace = null;
    latestPresentationPayload = null;
    latestSettingsPayload = null;
    latestFontsPayload = null;
    try {
      if (fs.existsSync(WORKSPACE_FILE)) fs.unlinkSync(WORKSPACE_FILE);
    } catch {
      // Ignore delete errors
    }
    res.json({ ok: true });
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use((req, res, next) => {
      if (
        req.path === '/' ||
        req.path === '/display' ||
        req.path.endsWith('.html')
      ) {
        setNoCacheHeaders(res);
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            setNoCacheHeaders(res);
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      setNoCacheHeaders(res);
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
