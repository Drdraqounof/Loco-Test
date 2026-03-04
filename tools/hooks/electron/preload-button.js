const { contextBridge, ipcRenderer } = require('electron');

console.log('=== Floating Button Preload Loading ===');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    window: {
      toggle: () => ipcRenderer.invoke('window:toggle'),
    },
  });
  
  console.log('✓ Floating button electronAPI exposed');
} catch (error) {
  console.error('✗ Failed to expose button electronAPI:', error);
}
