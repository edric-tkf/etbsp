const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const pkg = require('../package.json');

let controlWindow = null;
let displayWindow = null;
let embeddedServer = null;
let activePort = Number(process.env.PORT || 3000);

const EXTERNAL_START_URL = process.env.ELECTRON_START_URL || '';

function startEmbeddedServer() {
  if (EXTERNAL_START_URL) {
    return Promise.resolve(EXTERNAL_START_URL);
  }

  return new Promise((resolve, reject) => {
    const serverApp = express();
    serverApp.use(express.json({ limit: '15mb' }));

    const distDir = path.join(__dirname, '../dist');
    const server = http.createServer(serverApp);
    const wss = new WebSocketServer({ server, path: '/ws' });

    let latestPresentationPayload = null;
    let latestSettingsPayload = null;
    let latestFontsPayload = null;
    const clientMeta = new Map();

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
          if (parsed.type === 'presentation:update') latestPresentationPayload = parsed.payload;
          else if (parsed.type === 'settings:update') latestSettingsPayload = parsed.payload;
          else if (parsed.type === 'fonts:update') latestFontsPayload = parsed.payload;
          else if (parsed.type === 'ping') {
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
          // Ignore malformed frames
        }
      });

      ws.on('close', () => {
        clientMeta.delete(ws);
        broadcastPresence();
      });
    });

    serverApp.get('/api/health', (_req, res) => {
      res.json({ ok: true, service: 'ET BSP Desktop', version: pkg.version, port: activePort });
    });

    serverApp.get('/api/version', (_req, res) => {
      res.json({ app: 'ET BSP', version: pkg.version, timestamp: Date.now() });
    });

    serverApp.use(express.static(distDir));
    serverApp.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && activePort === 3000) {
        server.listen(0, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    server.on('listening', () => {
      const addr = server.address();
      activePort = typeof addr === 'object' && addr ? addr.port : activePort;
      embeddedServer = server;
      resolve(`http://localhost:${activePort}`);
    });

    server.listen(activePort, '127.0.0.1');
  });
}

let baseUrl = `http://localhost:${activePort}`;

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 700,
    title: 'ET BSP',
    backgroundColor: '#11141a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  controlWindow.loadURL(baseUrl);
  controlWindow.on('closed', () => {
    controlWindow = null;
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.close();
    }
  });
}

function openDisplayWindow(fullscreen = false) {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0) || displays[0];

  displayWindow = new BrowserWindow({
    x: externalDisplay.bounds.x + 40,
    y: externalDisplay.bounds.y + 40,
    width: 1280,
    height: 720,
    fullscreen,
    frame: !fullscreen,
    title: 'ET BSP - Presentation Output',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  displayWindow.loadURL(`${baseUrl}/display?view=display`);
  displayWindow.on('closed', () => {
    displayWindow = null;
  });
}

ipcMain.handle('bsp:open-display', (_event, opts) => {
  openDisplayWindow(Boolean(opts?.fullscreen));
  return { ok: true };
});

ipcMain.handle('bsp:toggle-display-fullscreen', () => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.setFullScreen(!displayWindow.isFullScreen());
    return { fullscreen: displayWindow.isFullScreen() };
  }
  return { fullscreen: false };
});

ipcMain.handle('bsp:get-displays', () => {
  return screen.getAllDisplays().map((d, idx) => ({
    id: d.id,
    label: d.label || `Display ${idx + 1}`,
    width: d.bounds.width,
    height: d.bounds.height,
    primary: d.bounds.x === 0 && d.bounds.y === 0,
  }));
});

app.whenReady().then(async () => {
  baseUrl = await startEmbeddedServer();
  createControlWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (embeddedServer) {
    embeddedServer.close();
    embeddedServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
