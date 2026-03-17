# Electron Desktop Setup

> **Last Updated:** March 9, 2026 at 1:14 PM

> **In plain terms:** This doc explains how the desktop Electron version of Loco is set up and how it works.

This project includes an Electron wrapper to run Loco as a cross-platform desktop app.

## What is Electron?

**Electron** is a framework for building desktop applications using web technologies (HTML, CSS, JavaScript/TypeScript).

**How it works:**
- Bundles **Chromium** (browser engine) + **Node.js** (backend runtime) into one app
- Your web app runs in a native window instead of a browser tab
- Has access to OS features: file system, clipboard, global hotkeys, system tray, etc.

**Key benefits:**
- Write once, deploy to Windows, macOS, and Linux
- Use familiar web technologies and npm packages
- Access native APIs that browsers can't (reading files, system shortcuts)

**Popular apps built with Electron:** VS Code, Slack, Discord, Notion, Figma

**Tradeoff:** Larger app size (~150MB+) since it ships an entire browser engine.

---

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
- **Ctrl+Space** - Show the Loco window and immediately start listening
- **Space** - When the main window is hidden, reopen Loco and start listening in overlay mode

## Features

### Overlay Voice Capture
Loco supports quick voice entry from overlay mode:
- Hide the main window with `Ctrl+Shift+L`
- Press `Space` to reopen it and start listening
- Press `Ctrl+Space` any time to bring the window forward and begin capture

Electron uses `MediaRecorder` for microphone capture, then sends the audio to `/api/stt` for transcription.

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

### STT Fallback Behavior
Electron desktop transcription is resilient to provider access issues:
- Tries OpenAI transcription models first
- Falls back across configured OpenAI STT models
- Uses Gemini transcription if OpenAI STT access is unavailable and `GEMINI_API_KEY` is set

## How It Works

1. **User presses Ctrl+Shift+L** → Loco window appears over the current app
2. **User presses Ctrl+Space or Space** → Loco starts listening immediately
3. **Electron records audio locally** → Audio is posted to `/api/stt`
4. **STT route transcribes the speech** → Using OpenAI STT models or Gemini fallback
5. **Loco answers in chat** → Code appears in the Workspace Preview panel, with separate Preview, Code, and Commands views
6. **Return to work** → Hide the window again and reopen from the overlay shortcut when needed

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
tools/hooks/electron/
├── main.js           → Electron entry point, window creation, hotkey registration
├── preload.js        → Secure IPC bridge between React and Electron
├── preload-button.js → Preload script for floating button window
└── floating-button.html → Floating button UI
```

**package.json configuration:**
```json
{
  "main": "tools/hooks/electron/main.js"
}
```

## Next Steps

1. Create a clipboard UI component to showcase clipboard features
2. Add file upload handling
3. Update styling to work as an overlay
4. Build native installers

## Troubleshooting

### "Cannot find module 'electron/main.js'" Error

**Problem:** Error dialog appears: "Unable to find Electron app" and "Cannot find module"

**Cause:** The `"main"` field in `package.json` points to wrong path.

**Solution:** Ensure `package.json` has correct path:
```json
"main": "tools/hooks/electron/main.js"
```

### Preload Script Syntax Error

**Problem:** Console shows "Unable to load preload script" with "SyntaxError: Unexpected token '}'"

**Cause:** Duplicate code at end of `preload.js` file.

**Solution:** Check `tools/hooks/electron/preload.js` for duplicate lines and remove them.

### Hotkey Not Working

- Make sure Next.js dev server is running on http://localhost:3000
- Check if another app registered the same hotkey (`Ctrl+Shift+L`, `Ctrl+Space`, or `Space`)
- Restart the Electron app

### Space Shortcut Does Nothing In Overlay Mode

**Problem:** Pressing `Space` does not reopen Loco when the window is hidden.

**Cause:** Another app may already own the global `Space` shortcut, or the main window is still visible.

**Solution:**
- Hide the main window first with `Ctrl+Shift+L`
- Try `Ctrl+Space` to confirm global shortcuts are working
- Check Electron logs for hotkey registration failures
- If `Space` conflicts with another app, switch to `Ctrl+Space`

### Can't Read/Write Clipboard

- Make sure preload.js is properly loaded
- Check DevTools console for errors (F12 when Electron window is focused)
- Verify contextBridge is exposing electronAPI correctly

### Transcription Model Access Errors

**Problem:** Console shows model-access errors such as not having access to `whisper-1`.

**Cause:** OpenAI transcription access varies by project and model.

**Solution:**
- Add `GEMINI_API_KEY` so Electron can fall back to Gemini transcription
- Optionally set `OPENAI_STT_MODELS` or `OPENAI_STT_MODEL` to the models your account can access
- Restart Next.js and Electron after changing environment variables

### Chat Area Not Fully Visible

**Problem:** Content is cut off, requiring scrolling in Electron window.

**Cause:** The `100vh` height doesn't account for Electron window frame.

**Solution:** The app now uses `calc(100vh - 32px)` when running in Electron (handled automatically via `useElectron` hook).
