const { contextBridge, ipcRenderer } = require('electron');

console.log('=== Preload Script Loading ===');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Clipboard operations
    clipboard: {
      read: () => ipcRenderer.invoke('clipboard:read'),
      write: (text) => ipcRenderer.invoke('clipboard:write', text),
    },
    
    // Window operations
    window: {
      toggle: () => ipcRenderer.invoke('window:toggle'),
    },
    
    // File operations
    file: {
      read: (filePath) => ipcRenderer.invoke('file:read', filePath),
    },

    attachments: {
      openFiles: () => ipcRenderer.invoke('attachments:pick-files'),
      openFolder: () => ipcRenderer.invoke('attachments:pick-folder'),
    },

    tts: {
      synthesize: (text, voice) => ipcRenderer.invoke('tts:synthesize', text, voice),
      status: (voice) => ipcRenderer.invoke('tts:status', voice),
    },
    
    // Platform info
    platform: process.platform,

    // Listen for main process trigger to start voice listening
    onStartListening: (callback) => {
      ipcRenderer.on('start-listening', () => callback());
    },
  });
  
  console.log('✓ electronAPI exposed successfully');
} catch (error) {
  console.error('✗ Failed to expose electronAPI:', error);
}
