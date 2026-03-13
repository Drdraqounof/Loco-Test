# Troubleshooting Guide

> **Last Updated:** March 9, 2026 at 1:14 PM

## Speech Recognition Issues

### Microphone Access Issues

**Problem**: "Microphone access denied" error

**Solutions**:
1. Check browser permissions - Click the camera/mic icon in the address bar
2. Grant microphone access when prompted
3. Verify system microphone is not muted (check OS settings)
4. Try another browser (Safari/Chrome may have different permissions)
5. Restart browser and try again

**Code Reference**: `hooks/useSpeechRecognition.ts` handles permission errors

---

### "net::ERR_INTERNET_DISCONNECTED" or No Internet

**Problem**: Speech recognition fails without error message

**Solutions**:
1. Verify internet connection is active
2. Check if router/WiFi is working
3. Some speech API calls require internet even for local usage
4. Use browser DevTools (F12) → Network tab to see if requests succeed

---

### Browser Not Showing Listening State (Orb not animating)

**Problem**: Microphone appears to be on but orb visualization doesn't react

**Solutions**:
1. Check browser console for JavaScript errors (F12 → Console)
2. Verify your browser supports Web Speech API:
   - Chrome/Edge: ✅ Full support
   - Firefox: ✅ Full support
   - Safari: ⚠️ Use `webkitSpeechRecognition` (requires macOS 10.15+)
3. Clear browser cache: Ctrl+Shift+Delete
4. Disable browser extensions (especially security-related ones)

---

### "NotAllowedError" or Permission Denied

**Problem**: Microphone or clipboard access throws `NotAllowedError`

**Solutions**:
1. Grant microphone permission in browser settings
2. Check if another tab is already using the microphone
3. Try incognito mode (helps with permission cache)
4. Check OS microphone privacy settings (Windows Settings → Privacy → Microphone)
5. If the error appears while copying code, verify the app is running on `localhost` or use the Electron desktop app, which uses the native clipboard API

---

### Speech Recognition Stops Unexpectedly

**Problem**: Listening stops mid-sentence or won't restart

**Solutions**:
1. In browser mode, Loco now uses continuous recognition, but browsers can still stop capture after permission changes or device interruptions
2. In Electron mode, recording continues until you stop it, then the audio is transcribed server-side
3. Try the desktop shortcut flow: hide the window, then press `Space` or `Ctrl+Space` to restart capture cleanly
4. Check browser or Electron console logs for microphone permission errors
5. If the microphone device changed, restart the app so it can reacquire the input source

---

### "Does Not Have Access To Model whisper-1"

**Problem**: STT fails with an error like `Project ... does not have access to model whisper-1`

**Solutions**:
1. This is an account/provider access issue, not a microphone capture failure
2. Loco now tries multiple OpenAI STT models automatically before failing
3. Add `GEMINI_API_KEY` so Electron can fall back to Gemini transcription
4. Optionally set `OPENAI_STT_MODELS` or `OPENAI_STT_MODEL` to a model list your account can access
5. Restart the dev server after changing environment variables

---

### Overlay Space Shortcut Not Working

**Problem**: Pressing `Space` does not reopen Loco in Electron overlay mode

**Solutions**:
1. Make sure the main window is hidden first; the `Space` shortcut is only active in overlay mode
2. Try `Ctrl+Space` to verify the main global listening shortcut still works
3. Check whether another application has claimed the `Space` global shortcut
4. Restart Electron after changing shortcut behavior

---

## Audio Playback Issues

### No Sound Playing

**Problem**: AI response text appears but no audio

**Solutions**:
1. Check browser volume is not muted
2. Check OS volume settings and mute status
3. Check if speaker/headphone is connected and working
4. Reload the page and try again
5. Check browser console for errors

---

### Autoplay Blocked by Browser

**Problem**: Audio won't play without user interaction

**Solutions**:
1. Browsers block autoplay without user gesture
2. Click on button/text first, then audio will play
3. Check browser autoplay settings:
   - Chrome: Settings → Privacy and security → Site settings → Sounds
4. Ensure user has interacted with page before autoplay occurs

---

### Audio Plays at Wrong Speed/Quality

**Problem**: Audio sounds distorted or too fast

**Solutions**:
1. This uses OpenAI TTS-1 model (fastest, slight quality trade-off)
2. Check audio playback device settings
3. Ensure OpenAI API quota is not exceeded
4. View API usage at https://platform.openai.com/account/usage/overview

---

### Audio Doesn't Loop or Replay Not Working

**Problem**: Can't replay audio or multiple plays interfere

**Solutions**:
1. Check browser console for errors
2. Ensure previous audio is fully stopped before playing new audio
3. Try different browser
4. Clear browser cache if problem persists

**Code Reference**: `hooks/useAudioPlayer.ts` - Uses `abort()` to stop previous playback

---

## Code Extraction Issues

### Code Block Not Appearing

**Problem**: AI response includes code but it's not shown in code panel

**Solutions**:
1. Check if response contains proper markdown code blocks:
   ```javascript
   // Code block should be wrapped in triple backticks with language
   console.log("Hello");
   ```
2. Verify language is specified (e.g., ```javascript, ```python)
3. Check browser console for regex errors
4. AI might not have generated code block - try asking more explicitly

---

### Multiple Code Blocks Not Showing

**Problem**: Only first code block displays when multiple blocks in response

**Solutions**:
1. This has been fixed - current regex uses `.g` flag for global matching
2. Reload page to ensure latest version
3. Check that each code block is properly formatted with triple backticks
4. Clear browser cache if still not working

**Code Reference**: `utils/messageParser.ts` - `extractMultipleCodeBlocks()` function

---

### Wrong Language Syntax Highlighting

**Problem**: Code shows but syntax highlighting is incorrect

**Solutions**:
1. Add language identifier to code block: ```javascript not just ```
2. Supported languages: javascript, python, bash, html, css, json, typescript, etc.
3. If language not recognized, falls back to plaintext
4. Check Prism.js documentation for full language list

---

### Copy to Clipboard Not Working

**Problem**: Copy button doesn't copy code

**Solutions**:
1. Browser requires HTTPS or localhost for clipboard access
2. Check if browser allows clipboard permissions
3. In Electron, Loco uses the native clipboard API, so desktop copy should work even when browser clipboard rules would block it
4. Try a different browser if the web app still cannot write to clipboard
5. Verify code block is valid text (not corrupted)

---

## Workspace Preview Issues

### Workspace Preview Panel Not Showing

**Problem**: A response contains code or commands but the right-side preview panel does not appear

**Solutions**:
1. Commands must start with `$` to be recognized as terminal commands
2. Example format:
   ```bash
   $ npm install
   $ npm run dev
   ```
3. UI previews require real renderable code such as HTML, SVG, JSX/TSX, or React-style JavaScript components
4. Check console for parsing errors

---

### Commands Showing In The Wrong Tab

**Problem**: Shell setup steps appear mixed into the Code tab

**Solutions**:
1. Mark shell snippets with a shell-family fence such as `bash`, `sh`, or `shell`
2. Prefix actual terminal commands with `$` so the parser can place them in the Commands tab
3. Keep source files and shell commands in separate fenced blocks when possible

---

### Live Preview Not Rendering

**Problem**: The Preview tab is missing or the UI does not render

**Solutions**:
1. The preview tab only appears for renderable snippets, not for plain shell commands or non-UI utility code
2. React previews work best with self-contained components that do not require extra package imports beyond React
3. If a snippet is not previewable, use the Code tab and run it inside the actual project instead

---

### Terminal Commands Not Executable

**Problem**: Terminal shows but commands can't be run

**Solutions**:
1. This is intentional for security - commands are displayed for manual execution
2. Copy command and paste into your actual terminal
3. Ensure you're in correct directory for command to work
4. Some commands might require elevated permissions (use `sudo` if needed)

---

## API Errors

### "Request timeout" or 30-second timeout

**Problem**: AI takes too long to respond and times out

**Solutions**:
1. Check internet connection speed
2. OpenAI API might be overloaded - try again in a few seconds
3. Complex requests take longer - ask simpler questions
4. Check OpenAI API status at https://status.openai.com
5. Verify your API key is valid and has quota

**Configuration**: Edit `utils/apiClient.ts` to change timeout (default 30s)

---

### "Failed after 2 retries"

**Problem**: Request fails even after automatic retries

**Solutions**:
1. Check your OpenAI API key is correct
2. Verify API key has available quota (check billing)
3. Check OpenAI API status
4. Try simpler request
5. Wait a minute and try again

**Code Reference**: `utils/apiClient.ts` - `callAIAPI()` retries twice with exponential backoff

---

### "OPENAI_API_KEY not found"

**Problem**: Error says environment variable is missing

**Solutions**:
1. Create `.env.local` file in project root
2. Add: `OPENAI_API_KEY=sk-...`
3. Restart development server: `npm run dev`
4. Ensure no spaces around equals sign
5. Check key is valid at https://platform.openai.com/account/api-keys

---

### "Invalid API key" or 401 Unauthorized

**Problem**: API rejects authentication

**Solutions**:
1. Copy API key directly from OpenAI dashboard (no typos)
2. Ensure key hasn't been revoked or deactivated
3. Check if different organization using same email (switch org if needed)
4. Regenerate key if unsure: https://platform.openai.com/account/api-keys
5. Wait 60 seconds after creating new key before using

---

### "Rate limit exceeded"

**Problem**: Too many requests to OpenAI API

**Solutions**:
1. Wait before making new requests (automatic backoff in place)
2. Reduce request frequency
3. Upgrade OpenAI plan for higher rate limits
4. Check usage at https://platform.openai.com/account/usage/overview

---

## Browser & Compatibility Issues

### Safari Not Working

**Problem**: Speech recognition or other features fail on Safari

**Solutions**:
1. Safari requires `webkitSpeechRecognition` (webkit prefix)
2. Ensure macOS 10.15+ and Safari 14+
3. Grant microphone permission in System Preferences → Privacy → Microphone
4. Some features may work differently - see Browser Support table in README
5. Try Chrome/Edge as workaround

---

### Mobile/Touch Issues

**Problem**: App doesn't work well on iPhone/Android

**Solutions**:
1. Web Speech API works on iOS 14.5+ and Android 4.1+
2. Try latest browser version (Chrome/Safari)
3. Some features (voice input) may behave differently on mobile
4. Ensure microphone permission granted to browser
5. Try desktop version for full functionality

---

### JavaScript Errors in Console

**Problem**: Browser console (F12) shows errors

**Solutions**:
1. **"Cannot read property of undefined"** → Reload page
2. **"Module not found"** → Run `npm install` again
3. **"TypeScript errors"** → Run `npm run build` to see details
4. **Scroll through errors** → Early errors may cascade to others (fix first one)
5. Report unexpected errors with full error message

---

### Page Loading Slowly

**Problem**: Initial load takes long time

**Solutions**:
1. First load includes dependency compilation (normal)
2. Subsequent loads should be faster
3. Check Network tab (F12) to identify slow resources
4. Ensure you have good internet connection
5. Try clearing cache (Ctrl+Shift+Delete)

---

## Performance Issues

### Orb Animation Stuttering

**Problem**: Visualization is jerky or laggy

**Solutions**:
1. Close other browser tabs/apps using GPU
2. Lower browser zoom level (Ctrl+0 to reset)
3. Disable browser extensions (especially heavy ones)
4. Update GPU drivers
5. Try different browser (Chrome → Edge → Firefox)

---

### High CPU Usage

**Problem**: Fan spinning, battery draining fast

**Solutions**:
1. Close unused browser tabs
2. Disable animation: Edit `OrbCanvas.tsx` to reduce frame rate
3. Check if microphone is continuously listening (click stop button)
4. Update browser to latest version
5. Check browser console for infinite loops

---

## Debugging Steps

### General Troubleshooting Workflow

1. **Open Developer Tools** (F12)
2. **Check Console tab** (Ctrl+Shift+K) for red error messages
3. **Check Network tab** for failed API calls
4. **Reload page** (Ctrl+R) - fixes many temporary issues
5. **Clear cache** (Ctrl+Shift+Delete) - fixes version-related issues
6. **Test in different browser** - isolates browser-specific issues
7. **Check `.env.local`** - verify API key exists and is correct
8. **Restart dev server** - `npm run dev` - fixes hot reload issues

### Getting Help

When reporting issues:
1. Include browser and OS version
2. Copy full error message from console
3. Screenshot of the problem
4. Steps to reproduce the issue
5. Whether issue happens in other browsers

---

## Known Limitations

- 🎙️ **Safari limitations**: Speech API may not recognize some accents
- 🌐 **Internet required**: Web Speech API requires connection
- 📱 **Mobile speech**: Some mobile browsers have reduced speech recognition
- 🔊 **Autoplay**: Audio requires user gesture (click) to start
- 💬 **Message history**: Clears on page reload (single-session only)

---

## Performance Tips

### Optimize Response Time

1. Ask specific, shorter questions
2. Avoid very long context in conversation history
3. Use simpler language instructions
4. Limit follow-up questions without new context

### Improve Audio Quality

1. Speak clearly for better recognition
2. Reduce background noise
3. Use quality microphone if available
4. Avoid speaking too fast

### Better Code Extraction

1. Ask AI to format code clearly in markdown blocks
2. Avoid inline code - request proper code blocks
3. Be specific about language (e.g., "JavaScript code")
4. Request one code block at a time if having issues

---

## Electron Issues

### "Cannot find module 'electron/main.js'" Error

**Problem**: Error dialog appears: "Unable to find Electron app" and "Cannot find module 'C:\Projects\loco\my-app\electron\main.js'. Please verify that the package.json has a valid 'main' entry"

**Cause**: The `"main"` field in `package.json` points to `electron/main.js`, but the actual Electron main file is located at `tools/hooks/electron/main.js`.

**Solutions**:
1. **Option A - Update package.json**: Change the `"main"` entry to point to the correct location:
   ```json
   "main": "tools/hooks/electron/main.js"
   ```
2. **Option B - Move the electron folder**: Copy or move `tools/hooks/electron/` to the project root as `electron/`
3. After fixing, restart the Electron app with `npm run electron:dev`

**Code Reference**: Check `package.json` "main" field and verify the path matches actual file location

---

Still stuck? Check the code comments in:
- `app/page.tsx` - Main component logic
- `hooks/useSpeechRecognition.ts` - Speech handling
- `hooks/useAudioPlayer.ts` - Audio playback
- `utils/apiClient.ts` - API calls with retry logic