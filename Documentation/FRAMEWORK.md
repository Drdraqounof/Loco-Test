# Loco Framework – Technical AI Assistant

> **Last Updated:** March 9, 2026 at 1:14 PM

## 1. Product Definition

**Loco** is a voice-enabled AI coding assistant that combines real-time speech synthesis, persistent chat memory, workspace preview tooling, and Google Calendar assistance into a single developer workflow.

**Core Value Proposition:**
- Write code faster with voice feedback
- Extract and inspect code in a dedicated workspace preview panel
- Learn through voice explanations of technical concepts
- Control playback and message flow with intuitive buttons
- Manage saved conversations and Google Calendar tasks from the same chat surface

---

## 2. Current Implementation (MVP)

### 2.1 Core Features – Live
| Feature | Status | Details |
|---------|--------|---------|
| **Chat Interface** | ✅ Live | Real-time conversation with gpt-4o-mini |
| **Voice Synthesis** | ✅ Live | Browser Web Speech API (free, zero-cost) |
| **Voice Control** | ✅ Live | Auto-play toggle, pause/resume, undo buttons, replay |
| **Code Extraction** | ✅ Live | Automated code block detection from AI responses |
| **Workspace Preview** | ✅ Live | Right-side panel with Preview, Code, and Commands tabs plus full-screen preview |
| **Code Review Pipeline** | ✅ Live | First-pass generation, internal QA review, optional revision, preview-error feedback loop |
| **Speech Recognition** | ✅ Live | Web Speech API in browser, MediaRecorder + STT route in Electron |
| **Voice Themes** | ✅ Live | 3 voice options (alloy, echo, fable) with color profiles |
| **Message Management** | ✅ Live | Undo last exchange, persisted session history, saved chat sidebar |
| **Desktop Overlay** | ✅ Live | Electron window toggle, quick-listen hotkeys, native clipboard |
| **Calendar Integration** | ✅ Live | Google OAuth connect/disconnect, draft-confirm create flow, live day-based read/delete |
| **Persistent Storage** | ✅ Live | Prisma + Neon/PostgreSQL for conversations, assistant memory, and calendar memory |

### 2.2 Architecture

**Frontend (Next.js 16):**
- `app/page.tsx` – Main chat UI component
- `tools/hooks/useSpeechRecognition.ts` – Browser speech + Electron recording/transcription flow
- `tools/hooks/useAudioPlayer.ts` – Audio playback logic (fallback)
- `tools/hooks/utils/messageParser.ts` – Extract code + commands from responses
- `tools/hooks/utils/themes.ts` – Voice theme styling system
- `components/ui/button.tsx` – Shared button styles for the refreshed UI
- `tools/hooks/electron/main.js` – Electron window lifecycle, hotkeys, permissions, overlay behavior
- `tools/hooks/electron/preload.js` – Secure IPC bridge for clipboard and overlay commands

**Backend (Node.js/Next.js API):**
- `app/api/route.ts` – OpenAI chat integration, memory handling, and Google Calendar intent routing
- `Documentation/LOCO_CODE_PIPELINE.md` – Detailed generate-review-revise and preview feedback pipeline reference
- `app/api/stt/route.ts` – Transcription endpoint with OpenAI model fallback + Gemini fallback
- `app/api/chat-sessions/route.ts` – Persisted conversation session list/save API
- `app/api/chat-sessions/[id]/route.ts` – Session delete API
- `app/api/google-calendar/*.ts` – OAuth connect, callback, and connection status endpoints
- Conditional TTS (skips server-side when using browser provider)

**Dependencies:**
- Next.js 16.1.6 with Turbopack
- TypeScript
- Framer Motion + Lucide React for the updated UI
- OpenAI API (gpt-4o-mini + optional STT/TTS)
- Gemini API (optional STT fallback)
- Prisma + Neon PostgreSQL
- Google Calendar API via `googleapis`
- Browser APIs: Web Speech API, Speech Recognition API

---

## 3. Development Roadmap

### Phase 1: Foundation ✅ (Complete)
- [x] Chat interface with message history
- [x] Web Speech API integration (free TTS)
- [x] Code extraction & workspace preview panel
- [x] Voice theme system
- [x] Speech recognition (microphone input)
- [x] Pause/resume controls
- [x] Undo/unsend messages
- [x] Filter URLs from speech output

### Phase 2: Enhanced Interaction 🔄 (Next)
- [ ] Screen reading with user permission (capture current screen for context)
- [ ] Save/export conversations
- [x] Conversation history sidebar
- [x] Keyboard shortcuts (record, replay/pause flow in app, overlay listen in Electron)
- [x] Copy-to-clipboard for code blocks
- [x] Browser preview for self-contained HTML, SVG, and React-style snippets
- [ ] Real terminal integration (optional: local SSH)
- [ ] User preferences (voice speed, pitch, volume)

### Phase 3: Guided Learning 📚 (Future)
- [ ] Progressive difficulty modes (beginner → advanced)
- [ ] Step-by-step command tutorials
- [ ] Common error explanations
- [ ] Code best practices hints
- [ ] Personalized learning paths
- [ ] Concept reinforcement through quizzes

### Phase 4: Production Ready 🚀 (Goal State)
- [ ] User authentication (GitHub OAuth via Neon Auth)
- [x] Persistent storage (PostgreSQL/Neon)
- [ ] Offline mode support
- [ ] Dark mode variants
- [ ] Multi-language support
- [ ] Analytics & usage tracking
- [ ] Premium features (custom voices, API credits)

---

## 4. Technical Specifications

### 4.1 Environment Variables
```env
OPENAI_API_KEY=<key>           # OpenAI gpt-4o-mini + tts-1
GEMINI_API_KEY=<key>           # Optional STT fallback for Electron
OPENAI_STT_MODELS=<list>       # Optional comma-separated OpenAI STT model fallback order
OPENAI_STT_MODEL=<model>       # Optional single OpenAI STT model override
GEMINI_STT_MODEL=<model>       # Optional Gemini transcription model override
DATABASE_URL=<postgresql_url>  # Neon PostgreSQL
AI_PROVIDER=openai             # Chat provider
TTS_PROVIDER=browser           # browser | openai | gemini
APP_URL=http://localhost:3000  # Base app URL for OAuth callbacks
GOOGLE_CLIENT_ID=<id>          # Google OAuth client id for Calendar
GOOGLE_CLIENT_SECRET=<secret>  # Google OAuth client secret for Calendar
GOOGLE_REDIRECT_URI=<url>      # Optional explicit callback override
```

### 4.2 Voice Mapping
| Voice Name | Browser Voice Index | Theme Color |
|-----------|-------------------|-------------|
| alloy | 0 | Blue (#00D9FF) |
| echo | 1 | Purple (#FF00FF) |
| fable | 2 | Green (#00FF88) |

### 4.3 Code Extraction Logic
1. AI responds with message
2. **messageParser.ts** scans for:
   - Markdown code blocks (```language ... ```)
   - Bash commands ($ prefix)
3. Shell-family blocks are treated as commands and shown in the **Commands** tab
4. Non-shell code is shown in the **Code** tab with line numbers and lightweight highlighting
5. Previewable HTML, SVG, and React-style snippets are rendered in the **Preview** tab and can be expanded full-screen

### 4.4 Speech Processing
1. In browser mode, `useSpeechRecognition.ts` uses continuous Web Speech API recognition
2. In Electron mode, `MediaRecorder` captures audio and posts it to `app/api/stt/route.ts`
3. The STT route tries configured OpenAI transcription models first
4. If OpenAI STT access fails, Gemini transcription can be used as fallback when configured
5. Response text is cleaned with `stripUrlsFromText(message)` before browser speech playback
6. Playback is chunked for more natural delivery and replay support

---

## 5. User Experience Flow

### Typical Workflow
```
1. User asks question (text or voice)
   ↓
2. If running in Electron, overlay shortcuts can reopen the app and start listening
   ↓
3. Loco responds with explanation + code
   ↓
4. Code is extracted → shown in the workspace preview panel
   ↓
5. Response is spoken aloud (auto-play if enabled)
   ↓
6. User can switch between Preview, Code, and Commands or open full-screen preview for interactive demos
   ↓
7. User copies code, reopens old sessions, or asks a follow-up
```

### Control Buttons
| Button | Action | When Available |
|--------|--------|----------------|
| 🔊 Auto-Play | Toggle voice responses | Always |
| ⏸️ Pause | Pause current speech | Speaking |
| ⏯️ Resume | Resume paused speech | Paused |
| 🎵 Play Voice | Replay last response | After response |
| ↶ Undo | Remove last Q&A pair | 2+ messages |
| 🎤 Listen | Start voice input | Always |

---

## 6. Design Principles

### 1. Voice-First, Not Voice-Only
- Text input always available
- Voice is enhancement, not requirement
- Keyboard shortcuts planned for power users

### 2. Code Clarity
- Separate explanation from execution space
- Workspace preview shows clean, copy-ready code
- No mixing of chat and code display

### 3. Developer Workflow
- Minimize friction between thinking and doing
- Context-aware explanations (concepts, not just answers)
- Practical over theoretical

### 4. Accessibility
- All features work without voice (fallback to text)
- Clear visual state indicators
- Pause/resume for better control
- Undo for mistake recovery

---

## 7. Performance & Scalability

### Current Constraints
- Web Speech API: Free, browser-native, zero latency
- OpenAI API: ~2-3s response time
- Google Calendar live read/delete currently supports day-based requests such as today, tomorrow, and weekday names

### Future Considerations
- Redis for conversation caching
- CDN for static assets
- Rate limiting on API calls
- Session management with JWT

---

## 8. API Integration

### OpenAI Chat Endpoint
- **Model:** gpt-4o-mini (cost-effective)
- **Temperature:** 0.7 (balanced creativity)
- **System Prompt:** Code generation + explanation focused
- **Resource Library:** JavaScript, Python, HTML, CSS, TypeScript links

### Optional: Server-Side TTS (Not Recommended)
- OpenAI TTS endpoint (costs $0.015/1K chars)
- Disabled by default (TTS_PROVIDER=browser)
- Fallback available if needed

---

## 9. Known Limitations & Trade-offs

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Web Speech quality varies by OS | Some voices sound robotic on Windows | Multiple voice options; user can disable |
| Browser-only (no mobile app yet) | Desktop-focused | PWA planned for Phase 3 |
| Live calendar delete is day-based | Can't yet target a specific event by title in chat | Ask for the day first, then confirm delete |
| Preview sandbox is isolated | Snippets requiring extra packages or app wiring may not render | Use the Code tab and run the code in the real project |
| Limited to 8K context | Long conversations excluded | Implement conversation summarization |

---

## 10. Success Metrics

### Phase 1 (Current)
- ✅ No compilation errors
- ✅ Voice plays without errors
- ✅ Code extraction works on all responses
- ✅ Pause/resume functional
- ✅ Undo removes messages correctly

### Phase 2 Target
- Response time < 2s
- 90%+ voice accuracy (browser API)
- 100% code extraction success rate
- 1000+ character conversations without lag

### Long-Term Goals
- 100K+ monthly active users
- 95% retention rate
- Sub-1s response time (cached + optimized)
- Multi-language support
- Enterprise integrations

---

## 11. Deployment

### Current
- Hosted on Vercel (Next.js native)
- GitHub: https://github.com/Drdraqounof/Loco-Test.git
- Environment: Production-ready
- Logs: Vercel dashboard

### Future Phases
- Custom domain
- Analytics (Posthog/Mixpanel)
- Error tracking (Sentry)
- Database backups (Neon automated)

---

## 12. Getting Started / Development Commands

```bash
# Install & run locally
npm install
npm run dev

# Build for production
npm run build

# Deploy
git push origin main  # Auto-deploys on Vercel

# Check errors
npm run build  # Shows any TypeScript/compilation errors
```

---

## 13. File Structure Reference

```
my-app/
├── app/
│   ├── page.tsx              # Main chat UI & state
│   ├── layout.tsx            # Root layout
│   ├── api/route.ts          # Chat, memory, and calendar assistant endpoint
│   ├── api/chat-sessions/    # Persisted chat session APIs
│   ├── api/google-calendar/  # Google OAuth + Calendar endpoints
│   └── globals.css           # Global styles
├── components/
│   └── ui/button.tsx         # Shared button UI
├── lib/
│   ├── assistantMemory.ts    # Long-term assistant memory
│   ├── calendarIntent.ts     # Calendar request parsing and draft helpers
│   ├── chatMemory.ts         # Session + remembered calendar persistence
│   ├── googleCalendar.ts     # Google Calendar live API helpers
│   └── prisma.ts             # Prisma client
├── prisma/
│   └── schema.prisma         # Database schema
├── tools/hooks/
│   ├── useSpeechRecognition.ts
│   ├── useAudioPlayer.ts
│   └── utils/messageParser.ts # Extract code + commands
├── .env                       # Secrets
├── package.json
└── tsconfig.json
```

---

## 14. Next Steps

**Immediate (This Week):**
1. Test live Google Calendar reads/deletes against real user calendars
2. Expand calendar delete flow to support title/time-specific targeting
3. Continue documentation cleanup for the refreshed architecture

**Short-term (This Month):**
1. Add conversation export feature
2. Expand preview sandbox coverage for more self-contained UI patterns
3. Add more granular settings and user preferences

**Medium-term (Next Quarter):**
1. User authentication with GitHub OAuth
2. PostgreSQL storage for conversations
3. Code execution sandbox (JavaScript)

---

## 15. Contact & Maintenance

**Repository:** https://github.com/Drdraqounof/Loco-Test.git

**Current Status:** Expanded MVP with persistence, workspace preview, and Google Calendar integration

**Maintainer:** Loco Dev Team

**Last Updated:** March 9, 2026

---

**This framework is a living document. Update it as features are added.**
