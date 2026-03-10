const { app, BrowserWindow, globalShortcut, ipcMain, screen, session, dialog } = require('electron');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

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

const MAX_ATTACHMENT_CHARS = 12000;
const MAX_FOLDER_CHARS = 32000;
const MAX_FOLDER_FILES = 20;
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'out']);
const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.php', '.java', '.cs', '.go', '.rs', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
  '.swift', '.kt', '.kts', '.scala', '.sh', '.bash', '.zsh', '.ps1', '.sql', '.prisma', '.html', '.css', '.scss', '.sass', '.less', '.json', '.yml',
  '.yaml', '.toml', '.xml', '.md', '.mdx', '.txt', '.log', '.env', '.ini', '.conf', '.config', '.csv', '.gitignore', '.dockerignore',
]);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']);
const PIPER_EXECUTABLE = process.env.PIPER_EXECUTABLE || process.env.PIPER_PATH || 'piper';

function getPiperVoiceConfig(voice) {
  const upperVoice = String(voice || 'echo').toUpperCase();
  return {
    executable: PIPER_EXECUTABLE,
    model: process.env[`PIPER_MODEL_${upperVoice}`] || process.env.PIPER_MODEL || '',
    config: process.env[`PIPER_CONFIG_${upperVoice}`] || process.env.PIPER_CONFIG || '',
    speaker: process.env[`PIPER_SPEAKER_${upperVoice}`] || process.env.PIPER_SPEAKER || '',
  };
}

function getPiperStatus(voice) {
  const config = getPiperVoiceConfig(voice);
  if (!config.model) {
    return {
      available: false,
      reason: 'Piper model path is not configured. Set PIPER_MODEL or PIPER_MODEL_<VOICE>.',
    };
  }

  return {
    available: true,
    reason: null,
    executable: config.executable,
    model: config.model,
  };
}

async function synthesizeWithPiper(text, voice) {
  const status = getPiperStatus(voice);
  if (!status.available) {
    throw new Error(status.reason || 'Piper is not configured.');
  }

  const config = getPiperVoiceConfig(voice);
  const tempPrefix = path.join(os.tmpdir(), 'loco-piper-');
  const tempDir = await fs.mkdtemp(tempPrefix);
  const outputPath = path.join(tempDir, 'speech.wav');
  const args = ['--model', config.model, '--output_file', outputPath];

  if (config.config) {
    args.push('--config', config.config);
  }

  if (config.speaker) {
    args.push('--speaker', String(config.speaker));
  }

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(config.executable, args, { windowsHide: true });
      let stderr = '';

      child.on('error', (error) => reject(error));
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(stderr.trim() || `Piper exited with code ${code}`));
      });

      child.stdin.write(text);
      child.stdin.end();
    });

    const audioBuffer = await fs.readFile(outputPath);
    return {
      audioBase64: audioBuffer.toString('base64'),
      mimeType: 'audio/wav',
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function normalizePathForUi(targetPath) {
  return targetPath.replace(/\\/g, '/');
}

function getExtension(targetPath) {
  return path.extname(targetPath || '').toLowerCase();
}

function detectAttachmentCategory(targetPath) {
  const extension = getExtension(targetPath);

  if (AUDIO_EXTENSIONS.has(extension)) {
    return 'audio';
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.rb', '.php', '.java', '.cs', '.go', '.rs', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.swift', '.kt', '.kts', '.scala', '.sh', '.bash', '.zsh', '.ps1', '.sql', '.prisma', '.html', '.css', '.scss', '.sass', '.less', '.json', '.yml', '.yaml', '.toml', '.xml', '.md', '.mdx'].includes(extension)
      ? 'code'
      : 'text';
  }

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return 'document';
  }

  return 'binary';
}

function isTextReadable(targetPath) {
  const category = detectAttachmentCategory(targetPath);
  return category === 'code' || category === 'text';
}

function isAudioFile(targetPath) {
  return detectAttachmentCategory(targetPath) === 'audio';
}

function shouldIgnoreTarget(targetPath) {
  const segments = normalizePathForUi(targetPath).split('/').filter(Boolean);
  return segments.some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

function trimContent(content, maxChars) {
  if (content.length <= maxChars) {
    return { text: content, truncated: false };
  }

  return {
    text: `${content.slice(0, maxChars)}\n...\n[truncated]`,
    truncated: true,
  };
}

function getMimeType(targetPath) {
  const extension = getExtension(targetPath);
  const knownMimeTypes = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
  };

  return knownMimeTypes[extension] || 'application/octet-stream';
}

async function buildFileAttachment(targetPath) {
  const stats = await fs.stat(targetPath);
  const category = detectAttachmentCategory(targetPath);
  const attachment = {
    id: `electron::${targetPath.toLowerCase()}::${stats.size}::${Math.floor(stats.mtimeMs)}`,
    name: path.basename(targetPath),
    kind: 'file',
    category,
    source: 'electron',
    size: stats.size,
    path: normalizePathForUi(targetPath),
    mimeType: getMimeType(targetPath),
  };

  if (isTextReadable(targetPath)) {
    const rawText = await fs.readFile(targetPath, 'utf-8');
    const trimmed = trimContent(rawText, MAX_ATTACHMENT_CHARS);
    attachment.content = trimmed.text;
    if (trimmed.truncated) {
      attachment.note = 'Text content truncated for prompt size control.';
    }
    return attachment;
  }

  if (isAudioFile(targetPath)) {
    const audioBuffer = await fs.readFile(targetPath);
    attachment.audioBase64 = audioBuffer.toString('base64');
    attachment.note = 'Audio attached. Transcription will be attempted before analysis.';
    return attachment;
  }

  attachment.note = `Attached as ${category}. Metadata is available even if the raw content is not readable.`;
  return attachment;
}

async function collectFolderFiles(rootPath, currentPath, collected) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = normalizePathForUi(path.relative(rootPath, absolutePath));

    if (shouldIgnoreTarget(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectFolderFiles(rootPath, absolutePath, collected);
      continue;
    }

    const stats = await fs.stat(absolutePath);
    collected.push({ absolutePath, relativePath, size: stats.size });
  }
}

async function buildFolderAttachment(targetPath) {
  const files = [];
  await collectFolderFiles(targetPath, targetPath, files);
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const lines = [];
  const notes = [];
  let charBudget = 0;
  let includedCount = 0;
  let totalSize = 0;

  for (const file of files) {
    totalSize += file.size;
  }

  for (const file of files) {
    if (includedCount >= MAX_FOLDER_FILES || charBudget >= MAX_FOLDER_CHARS) {
      break;
    }

    if (isTextReadable(file.absolutePath)) {
      const rawText = await fs.readFile(file.absolutePath, 'utf-8');
      const trimmed = trimContent(rawText, Math.min(MAX_ATTACHMENT_CHARS, Math.max(1200, MAX_FOLDER_CHARS - charBudget)));
      const section = `File: ${file.relativePath}\n${trimmed.text}`;
      lines.push(section);
      charBudget += section.length;
      includedCount += 1;
      if (trimmed.truncated) {
        notes.push(`${file.relativePath} was truncated.`);
      }
      continue;
    }

    if (isAudioFile(file.absolutePath)) {
      lines.push(`Audio: ${file.relativePath}`);
      includedCount += 1;
    }
  }

  if (files.length > MAX_FOLDER_FILES) {
    notes.push(`Only the first ${MAX_FOLDER_FILES} relevant files were included.`);
  }

  return {
    id: `electron-folder::${targetPath.toLowerCase()}::${files.length}::${totalSize}`,
    name: path.basename(targetPath),
    kind: 'folder',
    category: 'folder',
    source: 'electron',
    size: totalSize,
    path: normalizePathForUi(targetPath),
    fileCount: files.length,
    content: lines.join('\n\n'),
    note: notes.length > 0 ? notes.join(' ') : 'Folder attached for analysis.',
  };
}

async function pickAttachments(properties) {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties,
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return [];
  }

  const attachments = [];

  for (const targetPath of result.filePaths) {
    const stats = await fs.stat(targetPath);
    if (stats.isDirectory()) {
      attachments.push(await buildFolderAttachment(targetPath));
    } else {
      attachments.push(await buildFileAttachment(targetPath));
    }
  }

  return attachments;
}

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
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('attachments:pick-files', async () => pickAttachments(['openFile', 'multiSelections']));
ipcMain.handle('attachments:pick-folder', async () => pickAttachments(['openDirectory']));
ipcMain.handle('tts:status', async (_event, voice) => getPiperStatus(voice));
ipcMain.handle('tts:synthesize', async (_event, text, voice) => {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text is required for Piper synthesis.');
  }

  return synthesizeWithPiper(text, voice);
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
