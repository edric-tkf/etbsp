const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bibleSongProDesktop', {
  isElectron: true,
  platform: process.platform,
  openDisplayWindow: (fullscreen = false) => ipcRenderer.invoke('bsp:open-display', { fullscreen }),
  toggleDisplayFullscreen: () => ipcRenderer.invoke('bsp:toggle-display-fullscreen'),
  getDisplays: () => ipcRenderer.invoke('bsp:get-displays'),
});
