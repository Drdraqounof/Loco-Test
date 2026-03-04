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
    
    // Platform info
    platform: process.platform,
  });
  
  console.log('✓ electronAPI exposed successfully');
} catch (error) {
  console.error('✗ Failed to expose electronAPI:', error);
}
