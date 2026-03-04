# Electron Desktop Setup

This project now includes an Electron wrapper to run Loco as a desktop app with a floating overlay.

## Quick Start

### Development Mode
```bash
npm install
npm run electron:dev
```

This will start:
1. Next.js dev server on `http://localhost:3000`
2. Electron app window (waits for Next.js to be ready)

### Global Hotkey
- **Ctrl+Shift+L** - Toggle Loco window visibility (show/hide)

## Features

### Clipboard Integration
Paste/read directly from clipboard:
```typescript
// Read clipboard
const text = await window.electronAPI.clipboard.read();

// Write to clipboard
await window.electronAPI.clipboard.write('Hello World');
```

### File Drag & Drop
Users can drag files into Loco and read them:
```typescript
const content = await window.electronAPI.file.read(filePath);
```

### Window Control
Show/hide the window programmatically:
```typescript
await window.electronAPI.window.toggle();
```

## How It Works

1. **User presses Ctrl+Shift+L** → Loco window appears over current app
2. **User pastes content** (Ctrl+V works normally) or drags a file
3. **Send to Loco** → Calls your API with the content
4. **Copy result** → Click button to copy edited result back to clipboard
5. **Return to work** → Paste (Ctrl+V) or press hotkey again to hide

## Building for Distribution

```bash
npm run electron:build
```

This creates:
- Windows: `dist/Loco Setup X.X.X.exe` (installer)
- Windows: `dist/Loco X.X.X.exe` (portable)
- macOS: `dist/Loco-X.X.X.dmg`

## Files Structure

```
electron/
├── main.js           → Electron entry point, hotkey registration
├── preload.js        → Secure IPC bridge between React and Electron
└── window-manager.js → Window management utilities
```

## Next Steps

1. Create a clipboard UI component to showcase clipboard features
2. Add file upload handling
3. Update styling to work as an overlay
4. Build native installers

## Troubleshooting

**Hotkey not working?**
- Make sure Next.js dev server is running
- Check if another app registered the same hotkey

**Can't read/write clipboard?**
- Make sure preload.js is properly loaded
- Check DevTools console for errors (F12 when Electron window is focused)
