const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Server management
let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;

// Config file path
const configPath = path.join(os.homedir(), '.chat2response', 'config.json');
const configDir = path.dirname(configPath);

// Default config
const defaultConfig = {
  port: 3456,
  defaultProvider: 'deepseek',
  apiKeys: {
    glm: '',
    kimi: '',
    deepseek: '',
    minimax: ''
  },
  autoStart: false,
  minimizeToTray: true
};

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// Load config
function loadConfig() {
  ensureConfigDir();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return { ...defaultConfig, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return defaultConfig;
}

// Save config
function saveConfig(config) {
  ensureConfigDir();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save config:', e);
    return false;
  }
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Chat2Response',
    show: false // Don't show until ready
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle close
  mainWindow.on('close', (event) => {
    if (!isQuitting && loadConfig().minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Hardcoded transparent PNGs for macOS Tray (Lucide Zap style)
const TRAY_ICONS = {
  running: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAmCAYAAACoPemuAAAACXBIWXMAAAsTAAALEwEAmpwYAAABTGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4yLWMwMDAgNzkuMWI0NTI3LCAyMDIyLzExLzIyLTMwOjExOjExICAgICAgICAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMS9tbS8iCiAgICB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4xL3NUeXBlL1Jlc291cmNlUmVmIyIKICAgIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIgogICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iCiAgICB4cGE6Q3JlYXRvclRvb2w9IkFkb2JlIElsbHVzdHJhdG9yIDI3LjAgKE1hY2ludG9zaCkiCiAgICB4cGE6Q3JlYXRlRGF0ZT0iMjAyNi0wNC0wM1QxODozMDowMCswODowMCIKICAgIHhtcDpNb2RpZnlEYXRlPSIyMDI2LTA0LTAzVDE4OjMwOjAwKzA4OjAwIgogICAgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNi0wNC0wM1QxODozMDowMCswODowMCIKICAgIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ZDJhYmUzZmYtZDIzMS00YjllLWI4YTItZTJmZGUzZjc3NjcwIgogICAgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpkMmFiZTNmZi1kMjMxLTRiOWUtYjhhMi1lMmZkZTNmNzc2NzAiCiAgICB4cXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6ZDJhYmUzZmYtZDIzMS00YjllLWI4YTItZTJmZGUzZjc3NjcwIgogICB0aWZmOk9yaWVudGF0aW9uPSIxIgogICBleGlmOlBpeGVsWURpbWVuc2lvbj0iMzYiCiAgIGV4aWY6UGl4ZWxYRGltZW5zaW9uPSIzNiI+CiAgIDx4bXBNTTpEZXJpdmVkRnJvbQogICAgc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpkMmFiZTNmZi1kMjMxLTRiOWUtYjhhMi1lMmZkZTNmNzc2NzAiCiAgICBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOmQyYWJlM2ZmLWQyMzEtNGI5ZS1iOGEyLWUyZmRlM2Y3NzY3MCIvPgogIDwvcmRmOkRlc2NyaXB0aW9uPgogPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KPD94cGFja2V0IGVuZD0idyI/PvIsgu0AAAAJcEhZcwAACxMAAAsTAQCanBgAAABQSURBVFiF7dcxCgAhDETR9P7nLpYpUscmsLALv8InmSQUAFYatXv3Zp6Z78Z7Zq6Z78Z7Zs6Z78YnM++Z78YnM++Z78YnM++Z78YnM++Z78YnM++Z78YnM/+/A8vIGBAAAAAElFTkSuQmCC',
  stopped: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAmCAYAAACoPemuAAAACXBIWXMAAAsTAAALEwEAmpwYAAABTGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4yLWMwMDAgNzkuMWI0NTI3LCAyMDIyLzExLzIyLTMwOjExOjExICAgICAgICAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMS9tbS8iCiAgICB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4xL3NUeXBlL1Jlc291cmNlUmVmIyIKICAgIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIgogICAgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iCiAgICB4cGE6Q3JlYXRvclRvb2w9IkFkb2JlIElsbHVzdHJhdG9yIDI3LjAgKE1hY2ludG9zaCkiCiAgICB4cGE6Q3JlYXRlRGF0ZT0iMjAyNi0wNC0wM1QxODozMDowMCswODowMCIKICAgIHhtcDpNb2RpZnlEYXRlPSIyMDI2LTA0LTAzVDE4OjMwOjAwKzA4OjAwIgogICAgeG1wOk1ldGFkYXRhRGF0ZT0iMjAyNi0wNC0wM1QxODozMDowMCswODowMCIKICAgIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6ZDJhYmUzZmYtZDIzMS00YjllLWI4YTItZTJmZGUzZjc3NjcwIgogICAgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpkMmFiZTNmZi1kMjMxLTRiOWUtYjhhMi1lMmZkZTNmNzc2NzAiCiAgICB4cXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6ZDJhYmUzZmYtZDIzMS00YjllLWI4YTItZTJmZGUzZjc3NjcwIgogICB0aWZmOk9yaWVudGF0aW9uPSIxIgogICBleGlmOlBpeGVsWURpbWVuc2lvbj0iMzYiCiAgIGV4aWY6UGl4ZWxYRGltZW5zaW9uPSIzNiI+CiAgIDx4bXBNTTpEZXJpdmVkRnJvbQogICAgc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpkMmFiZTNmZi1kMjMxLTRiOWUtYjhhMi1lMmZkZTNmNzc2NzAiCiAgICBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOmQyYWJlM2ZmLWQyMzEtNGI5ZS1iOGEyLWUyZmRlM2Y3NzY3MCIvPgogIDwvcmRmOkRlc2NyaXB0aW9uPgogPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KPD94cGFja2V0IGVuZD0idyI/PvIsgu0AAAAJcEhZcwAACxMAAAsTAQCanBgAAABQSURBVFiF7dcxCgAhDETR9P7nLpYpUscmsLALv8InmSQUAFYatXv3Zp6Z78Z7Zq6Z78Z7Zs6Z78YnM++Z78YnM++Z78YnM++Z78YnM++Z78YnM++Z78YnM/+/A8vIGBAAAAAElFTkSuQmCC'
};

// Create tray icon
function createTray() {
  const image = nativeImage.createFromDataURL(TRAY_ICONS.stopped);
  if (process.platform === 'darwin') {
    image.setTemplateImage(true);
  }
  tray = new Tray(image);
  tray.setToolTip('Chat2Response');
  updateTrayMenu();
}

// Update tray icon based on server status
function updateTrayIcon() {
  if (!tray || process.platform !== 'darwin') return;
  const dataUrl = isServerRunning() ? TRAY_ICONS.running : TRAY_ICONS.stopped;
  const image = nativeImage.createFromDataURL(dataUrl);
  image.setTemplateImage(true);
  tray.setImage(image);
}

// Update tray menu
function updateTrayMenu() {
  if (!tray) return;
  
  updateTrayIcon();
  
  const config = loadConfig();
  const lang = config.language || 'zh';
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: lang === 'zh' ? '显示应用' : 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: isServerRunning() 
        ? (lang === 'zh' ? '✅ 运行中' : '✅ Running') 
        : (lang === 'zh' ? '⭕ 已停止' : '⭕ Stopped'),
      enabled: false
    },
    { type: 'separator' },
    {
      label: isServerRunning() 
        ? (lang === 'zh' ? '停止服务器' : 'Stop Server') 
        : (lang === 'zh' ? '启动服务器' : 'Start Server'),
      click: () => isServerRunning() ? stopServer() : startServer()
    },
    { type: 'separator' },
    {
      label: lang === 'zh' ? '退出' : 'Quit',
      click: () => {
        isQuitting = true;
        stopServer();
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// IPC handlers
ipcMain.handle('get-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', (event, config) => {
  return saveConfig(config);
});

ipcMain.handle('start-server', async () => {
  return await startServer();
});

ipcMain.handle('stop-server', async () => {
  return await stopServer();
});

ipcMain.handle('get-server-status', () => {
  return { running: isServerRunning(), port: loadConfig().port };
});

ipcMain.handle('open-config-dir', () => {
  require('electron').shell.openPath(configDir);
});

// Check Codex config
ipcMain.handle('check-codex-config', async () => {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');
  
  const codexConfigPath = path.join(os.homedir(), '.codex', 'config.toml');
  
  try {
    if (!fs.existsSync(codexConfigPath)) {
      return { exists: false, hasChat2Response: false };
    }
    
    const content = fs.readFileSync(codexConfigPath, 'utf8');
    const hasChat2Response = content.includes('Chat2Response') || 
                             content.includes('chat2response') ||
                             content.includes('localhost:3456');
    
    return { exists: true, hasChat2Response, path: codexConfigPath };
  } catch (error) {
    return { exists: false, hasChat2Response: false, error: error.message };
  }
});

// Apply Codex config
ipcMain.handle('apply-codex-config', async (event, configText) => {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');
  
  const codexDir = path.join(os.homedir(), '.codex');
  const codexConfigPath = path.join(codexDir, 'config.toml');
  
  try {
    // Ensure .codex directory exists
    if (!fs.existsSync(codexDir)) {
      fs.mkdirSync(codexDir, { recursive: true });
    }
    
    // Read existing config if any
    let existingConfig = '';
    if (fs.existsSync(codexConfigPath)) {
      existingConfig = fs.readFileSync(codexConfigPath, 'utf8');
      
      // Check if Chat2Response config already exists
      if (existingConfig.includes('Chat2Response') || existingConfig.includes('chat2response')) {
        // Replace existing Chat2Response config
        const chat2ResponseRegex = /\[model_providers\.local\][\s\S]*?(?=\[|$)/;
        if (chat2ResponseRegex.test(existingConfig)) {
          existingConfig = existingConfig.replace(chat2ResponseRegex, configText.replace('# 添加到 ~/.codex/config.toml\n\n', '') + '\n\n');
        } else {
          existingConfig += '\n\n' + configText;
        }
      } else {
        // Append new config
        existingConfig += '\n\n' + configText;
      }
    } else {
      existingConfig = configText;
    }
    
    fs.writeFileSync(codexConfigPath, existingConfig);
    return { success: true, path: codexConfigPath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

// Create application menu (for macOS menu bar and Windows menu)
function createApplicationMenu() {
  const template = [
    {
      label: 'Chat2Response',
      submenu: [
        {
          label: 'About Chat2Response',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Chat2Response',
              detail: 'A proxy server that enables OpenAI Codex to work with Chinese LLM providers.\n\nCreated with Kimi Code.'
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) mainWindow.show();
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Chat2Response',
          accelerator: 'CmdOrCtrl+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'CmdOrCtrl+Shift+H',
          role: 'hideOthers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            isQuitting = true;
            stopServer();
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Server',
      submenu: [
        {
          label: 'Start Server',
          accelerator: 'CmdOrCtrl+S',
          click: () => startServer(),
          visible: !isServerRunning()
        },
        {
          label: 'Stop Server',
          accelerator: 'CmdOrCtrl+S',
          click: () => stopServer(),
          visible: isServerRunning()
        },
        { type: 'separator' },
        {
          label: 'Open Config Directory',
          click: () => {
            require('electron').shell.openPath(configDir);
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'actualSize' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: async () => {
            await require('electron').shell.openExternal('https://github.com/wang-h/chat2response');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await require('electron').shell.openExternal('https://github.com/wang-h/chat2response/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'Documentation',
          click: async () => {
            await require('electron').shell.openExternal('https://github.com/wang-h/chat2response/blob/main/README.md');
          }
        }
      ]
    }
  ];

  // macOS specific adjustments
  if (process.platform === 'darwin') {
    // First menu is already set up for macOS app menu
  } else {
    // Windows/Linux: Add File menu
    template.unshift({
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'Ctrl+Q',
          click: () => {
            isQuitting = true;
            stopServer();
            app.quit();
          }
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Update menu when server status changes
function updateApplicationMenu() {
  createApplicationMenu();
}

// App events
app.whenReady().then(() => {
  createWindow();
  createTray();
  createApplicationMenu();
  
  // Auto-start server if configured
  const config = loadConfig();
  if (config.autoStart) {
    startServer();
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Don't quit on macOS, keep in dock
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});

app.on('quit', () => {
  stopServer();
});
