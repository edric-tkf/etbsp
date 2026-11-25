const { app, BrowserWindow, screen, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const pkg = require('../package.json');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  autoUpdater = null;
}

let controlWindow = null;
let displayWindow = null;
let embeddedServer = null;
let activeWss = null;
let activePort = Number(process.env.PORT || 3000);
let updaterInitialized = false;

const SERVER_BOOT_ID = `${pkg.version}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const EXTERNAL_START_URL = process.env.ELECTRON_START_URL || '';

function getWorkspaceFilePath() {
  return path.join(app.getPath('userData'), 'etbsp-workspace.json');
}

function readWorkspaceFromDisk() {
  try {
    const file = getWorkspaceFilePath();
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeWorkspaceToDisk(data) {
  try {
    const file = getWorkspaceFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmpFile = `${file}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf8');
    fs.renameSync(tmpFile, file);
  } catch (err) {
    console.error('Failed to persist ET BSP workspace:', err);
  }
}

function setNoCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendUpdateStatus(payload) {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send('bsp:update-status', payload);
  }
}

function initAutoUpdater() {
  if (!autoUpdater || updaterInitialized) return;
  updaterInitialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ status: 'checking', message: 'Checking GitHub Releases for updates...' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({
      status: 'available',
      version: String(info?.version || ''),
      message: `Update v${info?.version || ''} is ready to download.`,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({
      status: 'up-to-date',
      version: String(info?.version || app.getVersion()),
      message: `Running ET BSP v${app.getVersion()}. You are up to date.`,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(Number(progress?.percent || 0));
    sendUpdateStatus({
      status: 'downloading',
      percent,
      message: `Downloading update... ${percent}%`,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({
      status: 'downloaded',
      version: String(info?.version || ''),
      percent: 100,
      message: `Update v${info?.version || ''} downloaded. Click "Restart & Install Update" to apply.`,
    });
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus({
      status: 'error',
      message: err?.message ? `Update check failed: ${err.message}` : 'Update check failed.',
    });
  });
}

function startEmbeddedServer() {
  if (EXTERNAL_START_URL) {
    return Promise.resolve(EXTERNAL_START_URL);
  }

  return new Promise((resolve, reject) => {
    const serverApp = express();
    serverApp.use(express.json({ limit: '50mb' }));

    const distDir = path.join(__dirname, '../dist');
    const server = http.createServer(serverApp);
    const wss = new WebSocketServer({ server, path: '/ws' });
    activeWss = wss;

    let persistedWorkspace = readWorkspaceFromDisk();
    let latestPresentationPayload = persistedWorkspace?.presentationState || null;
    let latestSettingsPayload = persistedWorkspace?.displaySettings || null;
    let latestFontsPayload = persistedWorkspace?.customFonts || null;
    const clientMeta = new Map();

    function persistPartialWorkspace(patch) {
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

    function sendHelloAndLatest(ws) {
      ws.send(
        JSON.stringify({
          type: 'server:hello',
          version: app.isPackaged ? app.getVersion() : pkg.version,
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
          // Ignore malformed frames
        }
      });

      ws.on('close', () => {
        clientMeta.delete(ws);
        broadcastPresence();
      });
    });

    serverApp.get('/api/health', (_req, res) => {
      setNoCacheHeaders(res);
      res.json({
        ok: true,
        service: 'ET BSP Desktop',
        version: app.isPackaged ? app.getVersion() : pkg.version,
        bootId: SERVER_BOOT_ID,
        port: activePort,
      });
    });

    serverApp.get('/api/version', (_req, res) => {
      setNoCacheHeaders(res);
      res.json({
        app: 'ET BSP',
        version: app.isPackaged ? app.getVersion() : pkg.version,
        bootId: SERVER_BOOT_ID,
        timestamp: Date.now(),
      });
    });

    serverApp.get('/api/workspace', (_req, res) => {
      setNoCacheHeaders(res);
      res.json({
        exists: Boolean(persistedWorkspace),
        bootId: SERVER_BOOT_ID,
        data: persistedWorkspace,
      });
    });

    serverApp.get('/api/workspace/display', (_req, res) => {
      setNoCacheHeaders(res);
      res.json({
        bootId: SERVER_BOOT_ID,
        version: app.isPackaged ? app.getVersion() : pkg.version,
        presentationState: latestPresentationPayload || persistedWorkspace?.presentationState || null,
        displaySettings: latestSettingsPayload || persistedWorkspace?.displaySettings || null,
        customFonts: latestFontsPayload || persistedWorkspace?.customFonts || null,
      });
    });

    serverApp.put('/api/workspace', (req, res) => {
      setNoCacheHeaders(res);
      const body = req.body;
      if (!body || typeof body !== 'object') {
        res.status(400).json({ ok: false, error: 'Invalid workspace payload' });
        return;
      }
      const patch = {};
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

    serverApp.delete('/api/workspace', (_req, res) => {
      setNoCacheHeaders(res);
      persistedWorkspace = null;
      latestPresentationPayload = null;
      latestSettingsPayload = null;
      latestFontsPayload = null;
      try {
        const file = getWorkspaceFilePath();
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        // Ignore
      }
      res.json({ ok: true });
    });

    serverApp.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            setNoCacheHeaders(res);
          }
        },
      })
    );
    serverApp.get('*', (_req, res) => {
      setNoCacheHeaders(res);
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

ipcMain.handle('bsp:get-app-version', () => {
  return app.isPackaged ? app.getVersion() : pkg.version;
});

ipcMain.handle('bsp:check-for-updates', async (_event, opts) => {
  if (!autoUpdater || !app.isPackaged) {
    return {
      ok: false,
      fallbackToBrowser: true,
      reason: !app.isPackaged
        ? 'In-app installer updates require the installed Windows app.'
        : 'Updater module not available.',
    };
  }

  initAutoUpdater();

  const repoSlug = String(opts?.repoSlug || '')
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/+$/, '');
  if (repoSlug && repoSlug.includes('/')) {
    const [owner, repo] = repoSlug.split('/');
    if (owner && repo) {
      autoUpdater.setFeedURL({ provider: 'github', owner, repo });
    }
  }

  try {
    const res = await autoUpdater.checkForUpdates();
    return { ok: true, version: res?.updateInfo?.version || app.getVersion() };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || 'Unable to check GitHub Releases.',
    };
  }
});

ipcMain.handle('bsp:download-update', async () => {
  if (!autoUpdater || !app.isPackaged) {
    return { ok: false, error: 'In-app download requires installed desktop app.' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to download update.' };
  }
});

ipcMain.handle('bsp:install-update', () => {
  if (!autoUpdater || !app.isPackaged) {
    return { ok: false, error: 'In-app install requires installed desktop app.' };
  }
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.close();
  }
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
  return { ok: true };
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (controlWindow) {
      if (controlWindow.isMinimized()) controlWindow.restore();
      controlWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    baseUrl = await startEmbeddedServer();
    createControlWindow();
    initAutoUpdater();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createControlWindow();
      }
    });
  });
}

function shutdownEmbeddedServer() {
  if (activeWss) {
    try {
      for (const client of activeWss.clients) {
        client.terminate();
      }
      activeWss.close();
    } catch {
      // Ignore
    }
    activeWss = null;
  }
  if (embeddedServer) {
    try {
      embeddedServer.closeAllConnections?.();
      embeddedServer.close();
    } catch {
      // Ignore
    }
    embeddedServer = null;
  }
}

app.on('before-quit', () => {
  shutdownEmbeddedServer();
});

app.on('window-all-closed', () => {
  shutdownEmbeddedServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
