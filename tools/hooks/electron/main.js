const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;
let floatingButtonWindow;
let nextServerUrl = 'http://localhost:3000';
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

console.log('=== Electron App Starting ===');
console.log('isDev:', isDev);

function createMainWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Creating main window with preload:', preloadPath);
  
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    minWidth: 400,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    alwaysOnTop: false,
    skipTaskbar: false,
    show: false,
  });

  // Load the app
  const url = isDev ? nextServerUrl : `file://${path.join(__dirname, '../out/index.html')}`;
  console.log('Loading URL:', url);
  mainWindow.loadURL(url);

  // Wait for content to load, then show
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('✓ Loco window shown');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✓ Main app loaded in Electron');
  });

  if (isDev) {
    console.log('Opening DevTools...');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createFloatingButton() {
  console.log('Creating floating button window...');
  
  floatingButtonWindow = new BrowserWindow({
    width: 50,
    height: 50,
    minWidth: 50,
    minHeight: 50,
    maxWidth: 50,
    maxHeight: 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-button.js'),
    },
  });

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  floatingButtonWindow.setPosition(width - 65, height - 65);

  floatingButtonWindow.loadFile(path.join(__dirname, 'floating-button.html'));

  floatingButtonWindow.on('closed', () => {
    floatingButtonWindow = null;
  });

  console.log('✓ Floating button created at', width - 65, height - 65);
}

function registerGlobalHotkey() {
  const ret = globalShortcut.register('Control+Shift+L', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  if (!ret) {
    console.log('Failed to register global hotkey');
  }
}

app.on('ready', () => {
  console.log('App is ready, creating windows...');
  createMainWindow();
  createFloatingButton();
  registerGlobalHotkey();
  console.log('✓ Hotkey registered: Ctrl+Shift+L');
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
  if (floatingButtonWindow === null) {
    createFloatingButton();
  }
});

// Handle clipboard operations
ipcMain.handle('clipboard:read', async () => {
  const { clipboard } = require('electron');
  return clipboard.readText();
});

ipcMain.handle('clipboard:write', async (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return true;
});

// Handle window toggle
ipcMain.handle('window:toggle', async () => {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  }
});

// Handle file drop
ipcMain.handle('file:read', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});
