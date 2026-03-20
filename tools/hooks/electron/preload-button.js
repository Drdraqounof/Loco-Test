/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

// In plain terms: this preload file does the same safe bridge job, but for the floating button window.

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
