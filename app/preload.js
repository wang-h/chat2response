const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // Server
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  
  // Codex Config
  checkCodexConfig: () => ipcRenderer.invoke('check-codex-config'),
  applyCodexConfig: (configText) => ipcRenderer.invoke('apply-codex-config', configText),
  
  // Utils
  openConfigDir: () => ipcRenderer.invoke('open-config-dir'),
  
  // Events
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (event, status) => callback(status));
  }
});
