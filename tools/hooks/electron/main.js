const { app, BrowserWindow, globalShortcut, ipcMain, screen, session } = require('electron');

// Tracks whether the Space hotkey is currently registered (overlay mode only)
let spaceHotkeyRegistered = false;

function registerSpaceHotkey() {
  if (spaceHotkeyRegistered) return;
  const ok = globalShortcut.register('Space', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('start-listening');
    }
  });
  if (ok) {
    spaceHotkeyRegistered = true;
    console.log('✓ Space hotkey registered (overlay mode)');
  } else {
    console.log('✗ Failed to register Space hotkey');
  }
}

function unregisterSpaceHotkey() {
  if (!spaceHotkeyRegistered) return;
  globalShortcut.unregister('Space');
  spaceHotkeyRegistered = false;
  console.log('✓ Space hotkey unregistered (window visible)');
}
const path = require('path');

// Disable GPU to prevent GPU process crashes on Windows
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow;
let floatingButtonWindow;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// In production, point to your Vercel deployment
// Change this URL after deploying to Vercel
const PRODUCTION_URL = process.env.VERCEL_URL || 'https://your-app.vercel.app';
let nextServerUrl = isDev ? 'http://localhost:3000' : PRODUCTION_URL;

console.log('=== Electron App Starting ===');
console.log('isDev:', isDev);
console.log('Using URL:', nextServerUrl);

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

  // Load the app - use Vercel URL in production, localhost in dev
  console.log('Loading URL:', nextServerUrl);
  mainWindow.loadURL(nextServerUrl);

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

  // Register Space hotkey only while the window is hidden (overlay mode)
  mainWindow.on('hide', () => registerSpaceHotkey());
  mainWindow.on('show', () => unregisterSpaceHotkey());

  mainWindow.on('closed', () => {
    unregisterSpaceHotkey();
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
  // Ctrl+Shift+L: toggle window
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
    console.log('Failed to register Ctrl+Shift+L hotkey');
  }

  // Ctrl+Space: show window and start listening (overlay mode spacebar)
  const retSpace = globalShortcut.register('Control+Space', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      // Tell the renderer to start listening
      mainWindow.webContents.send('start-listening');
    }
  });

  if (!retSpace) {
    console.log('Failed to register Ctrl+Space hotkey');
  } else {
    console.log('✓ Hotkey registered: Ctrl+Space (overlay listen)');
  }
}

app.on('ready', () => {
  console.log('App is ready, creating windows...');

  // Set Content Security Policy to silence Electron's security warning.
  // Dev allows 'unsafe-eval' (required by Next.js HMR) and localhost WS.
  // Production tightens this down.
  const devCSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.openai.com ws://localhost:* http://localhost:*",
    "worker-src 'self' blob:",
  ].join('; ');

  const prodCSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.openai.com",
    "worker-src 'self' blob:",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDev ? devCSP : prodCSP],
      },
    });
  });

  // Grant microphone permission so getUserMedia works in overlay/Electron mode
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone') {
      callback(true);
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'microphone') {
      return true;
    }
    return false;
  });

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

// Handle screen reading (basic implementation)
ipcMain.handle('screen:read', async () => {
  const { clipboard } = require('electron');
  // Try to get selected text or fallback to clipboard
  let screenText = '';
  try {
    // Electron does not natively read screen text, but can access clipboard
    screenText = clipboard.readText();
  } catch (error) {
    screenText = '';
  }
  return screenText;
});
