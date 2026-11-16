const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bibleSongProDesktop', {
  isElectron: true,
  platform: process.platform,
  openDisplayWindow: (fullscreen = false) => ipcRenderer.invoke('bsp:open-display', { fullscreen }),
  toggleDisplayFullscreen: () => ipcRenderer.invoke('bsp:toggle-display-fullscreen'),
  getDisplays: () => ipcRenderer.invoke('bsp:get-displays'),
  getAppVersion: () => ipcRenderer.invoke('bsp:get-app-version'),
  checkForUpdates: (repoSlug) => ipcRenderer.invoke('bsp:check-for-updates', { repoSlug }),
  downloadUpdate: () => ipcRenderer.invoke('bsp:download-update'),
  installUpdate: () => ipcRenderer.invoke('bsp:install-update'),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('bsp:update-status', handler);
    return () => ipcRenderer.removeListener('bsp:update-status', handler);
  },
});
