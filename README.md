# 🎯 Loco - AI Voice Coding Assistant

> **Last Updated:** March 9, 2026

> **In plain terms:** This is the main overview for what Loco is, what it can do, and how the project is put together.

Loco is your intelligent voice-enabled coding companion. Simply speak your coding questions, and Loco responds with both voice and written explanations, complete with executable code examples.

---

## 🤔 What is Loco?

### In Plain English
Think of Loco as having an expert coding mentor who:
- **Listens** to your voice questions using your computer's microphone
- **Stays ready in desktop overlay mode** so you can reopen it and start listening quickly
- **Understands** what you're asking using AI conversation
- **Explains** concepts in clear, friendly language with their voice
- **Can draft Google Calendar events** from natural language and wait for your confirmation
- **Shows code** - automatically extracts and displays code examples you can copy and run
- **Remembers** your conversation history so you can ask follow-up questions

### In Technical Terms
Loco is a **Next.js-based, voice-enabled AI chatbot** that:
- Uses **Web Speech API** in the browser and **MediaRecorder + server transcription** in Electron
- Integrates **OpenAI's GPT-4o-mini** for Loco's explanation-first replies and fallback chat handling
- Can route code-heavy requests to **Anthropic Claude** when `ANTHROPIC_API_KEY` is configured
- Integrates **Google OAuth and Google Calendar API** for confirmed event creation
- Falls back across **multiple STT providers/models** when a transcription model is unavailable
- Extracts code blocks from AI responses using regex pattern matching
- Provides **text-to-speech** synthesis for response audio playback
- Manages conversation and session history client-side with proper TypeScript typing
- Includes accessibility features (ARIA live regions, keyboard navigation)

---

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (recommended) - [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
- OR manually:
  - Node.js 18 or higher
  - PostgreSQL 15 (for database)
  - OpenAI API key (recommended for Loco chat, TTS, and calendar parsing, get one at [platform.openai.com](https://platform.openai.com))
  - Anthropic API key (optional, enables Claude for code-heavy requests, get one at [console.anthropic.com](https://console.anthropic.com/))
  - Gemini API key (optional, used as Electron STT fallback if OpenAI transcription access is unavailable)
  - Google OAuth client credentials (optional, required for Google Calendar support)
  - A modern web browser

### Quick Start with Docker Compose (Recommended)

```bash
# Clone and navigate
git clone <repository-url>
cd my-app

# Create production environment file
cp .env.production.example .env.production
# Edit .env.production and add your OPENAI_API_KEY
# Optional: add ANTHROPIC_API_KEY to route code-heavy requests to Claude

# Start everything with one command
docker compose up -d

# Run database migrations (first time only)
docker compose exec app npm run prisma:migrate:deploy

# Check status
docker compose ps
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

**Expected Output** from `docker compose ps`:
```
NAME                COMMAND                  SERVICE      STATUS            PORTS
loco_app            "docker-entrypoint.s…"   app          Up (healthy)      0.0.0.0:3000->3000/tcp
loco_db             "docker-entrypoint.s…"   db           Up (healthy)      0.0.0.0:5432->5432/tcp
```

### Local Development (without Docker)

```bash
# Clone and navigate
git clone <repository-url>
cd my-app

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
# Optional: add ANTHROPIC_API_KEY for Claude code routing
# Optional: add GEMINI_API_KEY and Google OAuth values for Calendar support

# Development (hot reload)
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

### Google Calendar Setup

To enable Calendar support, set these variables in `.env` or `.env.production`:

```env
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback
```

Google Cloud Console requirements:
- Enable the Google Calendar API
- Create an OAuth client
- Add `http://localhost:3000/api/google-calendar/callback` as an authorized redirect URI
- Start the app, open Settings, and connect Google Calendar from the Integrations tab

### Electron Desktop Mode

```bash
# Start Next.js + Electron together
npm run electron:dev
```

Overlay shortcuts:
- **Ctrl+Shift+L** - Show or hide the Loco window
- **Ctrl+Space** - Show the window and immediately start listening
- **Space** - In overlay mode, when the main window is hidden, reopen Loco and start listening

### Useful Docker Commands

```bash
# View logs from all services
docker compose logs -f

# Stop all services
docker compose down

# Complete reset (removes database data)
docker compose down -v

# Rebuild and start fresh
docker compose up -d --build

# Run commands inside the app container
docker compose exec app npm run prisma:studio  # Open Prisma Studio
docker compose exec app npm run prisma:migrate:dev  # Create new migration
```

---

## 💡 How to Use Loco

### Basic Workflow

1. **Click the Microphone** 🎤
  - Browser mode uses Web Speech API directly
  - Electron mode records audio locally, then sends it to the STT route for transcription
  - Start speaking your coding question

2. **Ask Questions**
   - ✅ "Build me a React todo list component"
   - ✅ "How do I use useState hooks?"
   - ✅ "Debug this error: TypeError undefined is not a function"
   - ✅ "Create a responsive navbar"
  - ✅ "Schedule lunch with Sam tomorrow at 1 PM for 45 minutes"

3. **Get Answers**
   - AI responds with voice explanation
   - Written response appears in chat
  - Code blocks automatically extracted to the right-side **Workspace Preview** panel

4. **Copy Code**
  - Copy the active code block, all extracted code blocks, or all terminal commands
  - The panel keeps code and commands separate so you can copy exactly what you need
   - Green notification confirms success

5. **Run Commands**
   - Terminal commands (starting with `$`) shown separately
  - Review them in the Commands tab before running them in your terminal

6. **Preview Generated UI**
  - Use the panel tabs to switch between `Preview`, `Code`, and `Commands`
  - HTML, CSS, JavaScript, SVG, JSX, and TSX snippets can render inside the built-in sandbox when they are self-contained
  - Multi-block answers appear as selectable tabs so you can inspect each block independently

7. **Confirm Calendar Drafts**
  - Loco drafts the event first
  - You review the title, time, and timezone
  - Reply with `yes` to create it in Google Calendar
  - Reply with `no` or `cancel` to discard it

### Voice Controls
- **⏸️ Pause** - Stop AI from speaking (if auto-play enabled)
- **▶️ Resume** - Continue listening to response
- **🔊 Replay** - Hear response again
- **↩️ Undo** - Remove last Q&A pair
- **Ctrl+Space** - Reopen Loco and start listening in Electron
- **Space** - When the Electron window is hidden, reopen and listen immediately

### Navigation
- **Settings ⚙️** - Choose voice, enable experimental features
- **Clear 🗑️** - Start fresh conversation
- **Game 🎮** - Type "ping pong" to play hidden game (if enabled)

---

## ⚙️ Current Features

### 🎤 Voice & Audio
- ✅ Browser-native speech recognition on web
- ✅ Electron speech capture with server-side STT fallback
- ✅ AI voice responses with 3 voice options (Alloy, Echo, Fable)
- ✅ Pause/Resume speech control
- ✅ Replay button to hear answers again
- ✅ Auto-play TTS (optional, configurable in Settings)
- ✅ Desktop overlay shortcuts for fast voice capture

### 💬 Chat & Conversation
- ✅ Full conversation history tracking
- ✅ Chat session sidebar with reusable saved conversations
- ✅ 10 rotating prompt suggestions (3 shown, refresh for new ones)
- ✅ Markdown rendering (bold, italic, lists, headers, links)
- ✅ Code blocks hidden from chat (only shown in terminal panel)
- ✅ Message undo functionality
- ✅ Calendar intent detection with draft-and-confirm flow

### 📅 Calendar Integration
- ✅ Google OAuth connect and disconnect in Settings
- ✅ Draft-first event parsing from natural language
- ✅ Confirm with `yes` before creating events
- ✅ Cancel with `no` or `cancel`
- ✅ Browser-timezone-aware scheduling

### 📝 Code Management
- ✅ Automatic code extraction (detects code blocks with backticks)
- ✅ Multi-language support (JavaScript, Python, HTML, CSS, etc.)
- ✅ Copy-to-clipboard with Electron-safe desktop fallback
- ✅ Copy current block, all code blocks, or all terminal commands
- ✅ Terminal commands extraction ($ prefix)
- ✅ Dedicated preview panel with `Preview`, `Code`, and `Commands` tabs
- ✅ Line-numbered code view with lightweight syntax highlighting
- ✅ Built-in sandbox preview for HTML/CSS/JS, SVG, JSX, and TSX when the response is self-contained

### 🧩 Code Preview Panel
- The right-side panel behaves like a lightweight artifact viewer: choose the active code block, inspect highlighted source, or switch to a rendered preview.
- React previews are rendered in an isolated browser sandbox using a client-side transpile path, so they work best for self-contained snippets without external package imports.
- If a snippet is not previewable, Loco still shows the line-numbered code and command views.

### 🎨 Visual & Experience
- ✅ Three beautiful themes matching voice personalities
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Smooth animations and transitions
- ✅ Dark mode optimized interface

### 🧪 Experimental Features
- ✅ Ping Pong easter egg game (type "ping pong" in chat)
- ✅ Best of 5 scoring system
- ✅ Can be toggled on/off in Settings

### ⚡ Settings & Customization
- ✅ Voice selection (Alloy, Echo, Fable)
- ✅ Auto-play TTS toggle
- ✅ Ping Pong easter egg toggle
- ✅ Google Calendar connection status and connect/disconnect controls
- ✅ Settings persist across sessions (localStorage)

---

## 🐳 Architecture (Orchestration)

Loco runs as a **containerized two-service stack** using Docker Compose:

```
┌─────────────────────────────────────────┐
│          Docker Network                 │
│         (loco_network)                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────┐                   │
│  │   Next.js App    │                   │
│  │  (loco_app)      │◄────┐             │
│  │  Port: 3000      │     │ Uses        │
│  │  Status: Running │     │ Service     │
│  └──────────────────┘     │ Name: db    │
│                           │             │
│  ┌──────────────────┐     │             │
│  │  PostgreSQL 15   │─────┘             │
│  │   (loco_db)      │                   │
│  │  Port: 5432      │                   │
│  │  Status: Healthy │                   │
│  └──────────────────┘                   │
│       ↓                                 │
│   (Persistent                           │
│    Volume)                              │
│                                         │
└─────────────────────────────────────────┘
```

### Services

| Service | Image | Purpose | Hostname | Port |
|---------|-------|---------|----------|------|
| **app** | node:18-alpine | Next.js app | app | 3000 |
| **db** | postgres:15 | Database | db | 5432 |

### Communication

- **App → Database**: Uses service name `db:5432` (not localhost)
  - Inside Docker, containers use service names for networking
  - Environment: `DATABASE_URL=postgresql://user:pass@db:5432/loco_db`

### Networking

- **Network**: `loco_network` (bridge driver)
- **Isolation**: Services can only reach each other, not the host
- **Host Access**: Ports 3000 and 5432 are mapped to your machine

---

## ✨ Stability Features

Loco's orchestration includes **production-grade stability** features:

### 1. **Health Checks**

Database is deemed "healthy" when PostgreSQL is ready to accept connections:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U loco_user -d loco_db"]
  interval: 10s
  timeout: 5s
  retries: 5
```

App is healthy when it responds to HTTP requests:
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/"]
  interval: 30s
  timeout: 3s
  retries: 3
```

### 2. **Dependency Management**

The app **waits for database to be healthy** before starting:
```yaml
depends_on:
  db:
    condition: service_healthy  # Crucial: ensures DB is ready
```

**Why this matters**: Without `service_healthy`, the app would start while PostgreSQL is still initializing, causing connection errors.

### 3. **Restart Policies**

Both services use `restart: always`:
- If a service crashes, Docker automatically restarts it
- Automatic recovery from transient failures
- Tested with `docker kill <container>` and verified re-start

### 4. **Data Persistence**

Database uses a named volume (`postgres_data`):
```yaml
volumes:
  postgres_data:
driver: local
```

- Data survives container restarts
- Data is only lost with explicit `docker compose down -v`

### Testing Stability

Prove determinism (clean slate to full health):
```bash
# Completely remove everything
docker compose down -v

# Rebuild and start fresh
docker compose up -d --build

# Verify both services are healthy (wait 15 seconds)
sleep 15
docker compose ps

# Expected:
# loco_app  ✓ healthy
# loco_db   ✓ healthy
```

---

## 🔐 Environment Management

Production secrets are managed securely using environment files:

### Structure

```
my-app/
├── .env.production          # ← Secrets file (NOT in git)
├── .env.local              # ← Dev secrets (NOT in git)
├── docker-compose.yml      # ← References .env.production
└── .gitignore              # ← Excludes .env*
```

### Setup

1. **Create `.env.production`** with required secrets:
   ```env
   OPENAI_API_KEY=sk-your-actual-key-here
   POSTGRES_USER=loco_user
   POSTGRES_PASSWORD=loco_password
   POSTGRES_DB=loco_db
   ```

2. **Verify it's not tracked**:
   ```bash
   git status
   # .env.production should NOT appear (already in .gitignore)
   ```

3. **Docker Compose uses it**:
   ```yaml
   app:
     env_file: .env.production  # Loads variables into container
   ```

### Why Not Commit Secrets?

- ❌ Never commit API keys, passwords, or tokens
- ❌ Leaked secrets can be exploited forever
- ❌ Git history is permanent (even deleting doesn't fully remove)
- ✅ Use `.gitignore` and environment files instead
- ✅ In production, use secret management tools (AWS Secrets Manager, Vault, etc.)

---

## 💼 Business Value

For **BrightPath's educational mission**, orchestration provides:

### 1. **Reliability** 🛡️
- Students can trust Loco works, not "sometimes works"
- Automatic crash recovery keeps the assistant always available
- Healthcare analogy: You wouldn't use a patient monitor that crashes

### 2. **Consistency** 📦
- Same experience whether running locally or deployed
- Teammates and instructors get identical environments
- "Works on my machine" problem is solved

### 3. **Scalability** 📈
- Foundation for running multiple instances (each student gets one)
- Easy to deploy to cloud infrastructure (AWS, GCP, Vercel, etc.)
- As education scales, infrastructure scales

### 4. **Security** 🔒
- Secrets stay off developers' machines
- Database password never exposed in source code
- Foundation for compliance (FERPA, HIPAA, etc.)

### 5. **Developer Experience** ✨
- **One command startup**: `docker compose up -d`
- **No local setup required**: Developers don't install PostgreSQL manually
- **Onboarding**: New team members clone → `docker compose up` → coding (3 minutes)
- **Troubleshooting**: Issues are reproducible and debuggable

### 6. **Cost Efficiency** 💰
- Minimal resource overhead (Node + PostgreSQL containerized)
- Can run on low-cost cloud infrastructure
- Pay for what you use, not for oversized servers

### BrightPath Context

For an **AI voice tutoring platform**, reliability is non-negotiable:
- **Students depend on it**: Studying for exams, learning new skills
- **Instructors monitor it**: Ensuring availability for classes
- **Legal responsibility**: Data privacy and uptime guarantees
- **Competitive edge**: Works reliably while competitors have downtime

Orchestration using Docker Compose is the industry standard for this reason.

---

## 🏗️ Architecture & Framework

### Tech Stack
```
Frontend:  Next.js 16.1.6 (with Turbopack for fast builds)
Language:  TypeScript (strict mode)
Styling:   CSS-in-JS (React inline styles)
Voice:     Web Speech API (browser native)
AI:        OpenAI GPT-4o-mini (chat) + TTS-1 (voice)
State:     React Hooks (useState, useRef, useEffect)
```

### Project Structure

```
loco/
├── Documentation/                # All documentation files
│   ├── DOCKER.md                # Docker deployment guide
│   ├── ELECTRON_SETUP.md        # Electron desktop app guide
│   ├── FRAMEWORK.md             # Technical specs & roadmap
│   ├── GETTING_STARTED_WINDOWS.md
│   ├── Troubleshoot.md          # Debugging guides
│   ├── UPDATE.md                # Change log
│   └── WEB_SPEECH_DOCUMENTATION.md
│
└── my-app/
    ├── app/
    │   ├── page.tsx              # Main chat interface
    │   ├── settings/page.tsx     # Settings page
    │   ├── experimental/         # Experimental games
    │   │   ├── page.tsx          # Games index
    │   │   ├── chess/page.tsx    # Chess game
    │   │   └── game/page.tsx     # Ping Pong game
    │   ├── layout.tsx            # Root layout
    │   ├── globals.css           # Global styles
    │   └── api/
    │       ├── route.ts          # OpenAI chat endpoint
    │       ├── stt/route.ts      # Speech-to-text endpoint
    │       └── docker/route.ts   # Docker status endpoint
    │
    ├── components/
    │   ├── CommandTerminal.tsx   # Terminal display component
    │   ├── ClipboardIntegration.tsx
    │   └── FloatingButton.tsx
    │
    ├── experimental/             # Game components
    │   ├── ChessGame.tsx
    │   ├── PingPongGame.tsx
    │   ├── chess/page.tsx
    │   └── game/page.tsx
    │
    ├── tools/hooks/              # Custom React hooks
    │   ├── useSpeechRecognition.ts
    │   ├── useAudioPlayer.ts
    │   ├── useElectron.ts        # Electron detection hook
    │   ├── electron/             # Electron desktop app
    │   │   ├── main.js           # Electron entry point
    │   │   ├── preload.js        # IPC bridge
    │   │   └── floating-button.html
    │   └── utils/
    │       ├── apiClient.ts      # OpenAI API communication
    │       ├── messageParser.ts  # Code extraction
    │       ├── themes.ts         # Voice themes
    │       └── codeProcessor.ts
    │
    ├── prisma/                   # Database schema
    └── public/                   # Static assets
```

### Key Components

#### 1. **Speech Recognition** (`hooks/useSpeechRecognition.ts`)
- Captures voice input from user's microphone
- Converts speech to text automatically
- Handles browser permission requests

#### 2. **API Client** (`utils/apiClient.ts`)
- Sends conversation history to OpenAI
- Implements retry logic (up to 3 attempts)
- Handles network timeouts (30 seconds)

#### 3. **Message Parser** (`utils/messageParser.ts`)
- Extracts code blocks from AI responses
- Separates terminal commands ($ prefix)
- Removes markdown for clean display
- Supports multiple code blocks in one response

#### 4. **Themes** (`utils/themes.ts`)
- Defines color scheme for each voice
- Centralizes design tokens
- Easy to customize or add new themes

### State Management

Using **React Hooks** for simple, effective state:

```typescript
const [voice, setVoice] = useState<VoiceKey>("echo");           // Selected voice
const [conversationHistory, setConversationHistory] = useState([]);  // Chat messages
const [autoPlayAudio, setAutoPlayAudio] = useState(false);      // TTS setting
const [enablePingPong, setEnablePingPong] = useState(true);     // Game toggle
const [suggestedPrompts, setSuggestedPrompts] = useState([]);   // 3 random prompts
```

**No Redux/Context needed** - component is fully self-contained and performant.

### Data Flow

```
User speaks
    ↓
Web Speech API → converts to text
    ↓
User message added to conversationHistory
    ↓
API call to /api with full history + voice selection
    ↓
OpenAI returns response
    ↓
messageParser extracts code blocks & commands
    ↓
Display in chat + code panel
    ↓
TTS synthesizes and plays audio (if enabled)
```

---

## 📊 Current Prompt Suggestions

Loco comes with **10 rotating starter prompts**. On each page reload, **3 random prompts** are selected from this pool to help you get started.

### The Full Prompt Library

| # | Emoji | Prompt |
|---|-------|--------|
| 1 | 📝 | **Build a React Todo List component** with add, delete, and localStorage persistence |
| 2 | 💡 | **Explain React hooks** (useState, useEffect, useRef) with practical examples |
| 3 | 🐛 | **Help me debug:** 'TypeError: undefined is not a function' in JavaScript |
| 4 | 🎨 | **Create a responsive Navbar component** using React and Tailwind CSS |
| 5 | ⚡ | **Optimize this React component** for performance (re-renders, memoization, keys) |
| 6 | 📚 | **Explain the difference** between var, let, and const with real examples |
| 7 | 🔧 | **Set up a Next.js project** with TypeScript and ESLint step-by-step |
| 8 | 🌐 | **Build a React form** with validation using React Hook Form or custom validation |
| 9 | 📊 | **Create a data visualization dashboard** using Chart.js in React |
| 10 | 🚀 | **Deploy a Next.js app** to Vercel with environment variables configured |

### How It Works

1. **Page loads** → 3 random prompts selected from the 10 above
2. **You see suggestions** → Three prompt chips appear in the chat header
3. **Click any prompt** → Message auto-fills and sends to the AI
4. **Refresh the page** → New 3 prompts randomly selected (likely different ones)

### Why These Prompts?

These prompts cover the **essential developer workflows**:
- 🎯 **Component Building** - React components with real features
- 🧠 **Concept Learning** - JavaScript fundamentals and React hooks
- 🐛 **Debugging** - Common errors and solutions
- 🎨 **UI/UX** - Responsive design and forms
- ⚡ **Performance** - Optimization techniques
- 🔧 **Setup & Config** - Project initialization
- 📊 **Advanced** - Dashboards and data viz
- 🚀 **Deployment** - Going live to production

---

## 🔧 Configuration

### Environment Variables

Create `.env.local`:
```env
OPENAI_API_KEY=sk-... (required - your OpenAI API key)
```

### Customization

**Change Voice Options** → Edit `utils/themes.ts`
**Adjust API Timeouts** → Edit `utils/apiClient.ts`
**Modify Prompts** → Edit `app/page.tsx` (lines 29-38)

---

## 🌐 Browser Support

| Browser | Voice | TTS | Code |
|---------|-------|-----|------|
| Chrome 90+ | ✅ | ✅ | ✅ |
| Firefox 89+ | ✅ | ✅ | ✅ |
| Safari 15+ | ⚠️ Limited | ✅ | ✅ |
| Edge 90+ | ✅ | ✅ | ✅ |
| Mobile (iOS/Android) | ✅ | ✅ | ✅ |

*Speech recognition works best in Chrome/Edge. Safari has limited support.*

---

## 📱 Routes

- **`/`** - Main chat interface
- **`/settings`** - Voice, TTS, and experimental features settings
- **`/experimental`** - Experimental games index
- **`/experimental/chess`** - Chess game
- **`/experimental/game`** - Ping Pong game

---

## 🖥️ Electron Desktop App

Loco can run as a native desktop application using Electron:

```bash
# Development mode
npm run electron:dev

# Build for distribution
npm run electron:build
```

**Features:**
- Global hotkey: **Ctrl+Shift+L** to toggle window
- Clipboard integration (read/write)
- File drag & drop support
- Native window controls

See [Documentation/ELECTRON_SETUP.md](./Documentation/ELECTRON_SETUP.md) for full guide.

---

## 🎯 Prompt Engineering

The system prompt (in `app/api/route.ts`) instructs the AI to:
- Always provide working code in markdown code blocks with backticks
- Focus on practical, executable examples
- Keep explanations clear and concise
- Separate terminal commands with `$` prefix
- Include comments in code blocks

---

## 📈 Performance

- **Page Load**: ~2-3 seconds (Turbopack)
- **Speech Recognition**: <100ms latency
- **API Response**: 2-5 seconds typical
- **TTS Playback**: Real-time
- **Build Time**: ~5 seconds

---

## 🐛 Troubleshooting

See [Documentation/Troubleshoot.md](./Documentation/Troubleshoot.md) for detailed debugging guides.

Common issues:
- Speech recognition not working? Check microphone permissions
- No AI responses? Check OpenAI API key in `.env.local`
- Code not showing? Ensure AI response contains code blocks with backticks

---

## 📚 Documentation

All documentation is in the `Documentation/` folder:

| File | Description |
|------|-------------|
| [DOCKER.md](./Documentation/DOCKER.md) | Docker deployment guide |
| [ELECTRON_SETUP.md](./Documentation/ELECTRON_SETUP.md) | Electron desktop app setup |
| [FRAMEWORK.md](./Documentation/FRAMEWORK.md) | Technical specs & roadmap |
| [GETTING_STARTED_WINDOWS.md](./Documentation/GETTING_STARTED_WINDOWS.md) | Windows setup guide |
| [Troubleshoot.md](./Documentation/Troubleshoot.md) | Debugging guides |
| [UPDATE.md](./Documentation/UPDATE.md) | Change log |
| [WEB_SPEECH_DOCUMENTATION.md](./Documentation/WEB_SPEECH_DOCUMENTATION.md) | Web Speech API reference |

---

## 📚 Learning Resources

- [Next.js Documentation](https://nextjs.org)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

---

## 📝 License

MIT - Feel free to use, modify, and distribute

---

## 🤝 Contributing

Have ideas for Loco? Found a bug? Issues and pull requests welcome!

---

**Made with ❤️ for developers who love voice interaction**
