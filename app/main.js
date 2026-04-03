const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
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

// Create tray icon
function createTray() {
  // Use a simple colored square as tray icon (can be replaced with actual icon)
  const trayIconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  
  // Create a simple tray icon if doesn't exist
  if (!fs.existsSync(trayIconPath)) {
    tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
  } else {
    tray = new Tray(trayIconPath);
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Server Status',
      submenu: [
        {
          label: isServerRunning() ? 'Running' : 'Stopped',
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Start Server',
          click: () => startServer(),
          visible: !isServerRunning()
        },
        {
          label: 'Stop Server',
          click: () => stopServer(),
          visible: isServerRunning()
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        stopServer();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Chat2Response');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    } else {
      createWindow();
    }
  });
}

// Check if server is running
function isServerRunning() {
  return serverProcess !== null;
}

// Start server
async function startServer() {
  if (serverProcess) {
    return { success: true, message: 'Server already running' };
  }

  const config = loadConfig();
  
  // Validate at least one API key
  const hasApiKey = Object.values(config.apiKeys).some(key => key && key.trim().length > 0);
  if (!hasApiKey) {
    return { success: false, message: 'Please configure at least one API key' };
  }

  try {
    // Set environment variables
    process.env.GLM_API_KEY = config.apiKeys.glm || '';
    process.env.KIMI_API_KEY = config.apiKeys.kimi || '';
    process.env.DEEPSEEK_API_KEY = config.apiKeys.deepseek || '';
    process.env.MINIMAX_API_KEY = config.apiKeys.minimax || '';
    process.env.DEFAULT_PROVIDER = config.defaultProvider;
    process.env.PORT = config.port.toString();
    process.env.DEBUG = 'false';

    // Import and start server
    const { startProxyServer } = require('./server/server-wrapper');
    serverProcess = await startProxyServer(config.port);
    
    // Update UI
    if (mainWindow) {
      mainWindow.webContents.send('server-status', { running: true, port: config.port });
    }
    
    updateTrayMenu();
    updateApplicationMenu();
    
    return { success: true, message: `Server started on port ${config.port}` };
  } catch (error) {
    console.error('Failed to start server:', error);
    serverProcess = null;
    return { success: false, message: error.message };
  }
}

// Stop server
async function stopServer() {
  if (!serverProcess) {
    return { success: true, message: 'Server not running' };
  }

  try {
    await serverProcess.stop();
    serverProcess = null;
    
    if (mainWindow) {
      mainWindow.webContents.send('server-status', { running: false });
    }
    
    updateTrayMenu();
    updateApplicationMenu();
    
    return { success: true, message: 'Server stopped' };
  } catch (error) {
    console.error('Failed to stop server:', error);
    return { success: false, message: error.message };
  }
}

// Update tray menu
function updateTrayMenu() {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Server Status',
      submenu: [
        {
          label: isServerRunning() ? `Running on port ${loadConfig().port}` : 'Stopped',
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Start Server',
          click: () => startServer(),
          visible: !isServerRunning()
        },
        {
          label: 'Stop Server',
          click: () => stopServer(),
          visible: isServerRunning()
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Quit',
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
