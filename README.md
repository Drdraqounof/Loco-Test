# 🎯 Loco - AI Voice Coding Assistant

Loco is your intelligent voice-enabled coding companion. Simply speak your coding questions, and Loco responds with both voice and written explanations, complete with executable code examples.

---

## 🤔 What is Loco?

### In Plain English
Think of Loco as having an expert coding mentor who:
- **Listens** to your voice questions using your computer's microphone
- **Understands** what you're asking using AI conversation
- **Explains** concepts in clear, friendly language with their voice
- **Shows code** - automatically extracts and displays code examples you can copy and run
- **Remembers** your conversation history so you can ask follow-up questions

### In Technical Terms
Loco is a **Next.js-based, voice-enabled AI chatbot** that:
- Uses **Web Speech API** for browser-native speech recognition (zero server-side auth required)
- Integrates **OpenAI's GPT-4o-mini** for intelligent conversation and code generation
- Extracts code blocks from AI responses using regex pattern matching
- Provides **text-to-speech** synthesis for response audio playback
- Manages conversation state client-side with proper TypeScript typing
- Includes accessibility features (ARIA live regions, keyboard navigation)

---

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (recommended) - [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
- OR manually:
  - Node.js 18 or higher
  - PostgreSQL 15 (for database)
  - OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))
  - A modern web browser

### Quick Start with Docker Compose (Recommended)

```bash
# Clone and navigate
git clone <repository-url>
cd my-app

# Create production environment file
cp .env.production.example .env.production
# Edit .env.production and add your OPENAI_API_KEY

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
cp .env.production .env.local
# Edit .env.local and add your OPENAI_API_KEY

# Development (hot reload)
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

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
   - Browser will ask permission to access your microphone (one time)
   - Start speaking your coding question

2. **Ask Questions**
   - ✅ "Build me a React todo list component"
   - ✅ "How do I use useState hooks?"
   - ✅ "Debug this error: TypeError undefined is not a function"
   - ✅ "Create a responsive navbar"

3. **Get Answers**
   - AI responds with voice explanation
   - Written response appears in chat
   - Code blocks automatically extracted to **Code & Terminal Commands** panel

4. **Copy Code**
   - Green copy button appears on code blocks
   - One click copies to clipboard
   - Green notification confirms success

5. **Run Commands**
   - Terminal commands (starting with `$`) shown separately
   - Copy individual command or all at once

### Voice Controls
- **⏸️ Pause** - Stop AI from speaking (if auto-play enabled)
- **▶️ Resume** - Continue listening to response
- **🔊 Replay** - Hear response again
- **↩️ Undo** - Remove last Q&A pair

### Navigation
- **Settings ⚙️** - Choose voice, enable experimental features
- **Clear 🗑️** - Start fresh conversation
- **Game 🎮** - Type "ping pong" to play hidden game (if enabled)

---

## ⚙️ Current Features

### 🎤 Voice & Audio
- ✅ Real-time speech recognition (no server required)
- ✅ AI voice responses with 3 voice options (Alloy, Echo, Fable)
- ✅ Pause/Resume speech control
- ✅ Replay button to hear answers again
- ✅ Auto-play TTS (optional, configurable in Settings)

### 💬 Chat & Conversation
- ✅ Full conversation history tracking
- ✅ 10 rotating prompt suggestions (3 shown, refresh for new ones)
- ✅ Markdown rendering (bold, italic, lists, headers, links)
- ✅ Code blocks hidden from chat (only shown in terminal panel)
- ✅ Message undo functionality

### 📝 Code Management
- ✅ Automatic code extraction (detects code blocks with backticks)
- ✅ Multi-language support (JavaScript, Python, HTML, CSS, etc.)
- ✅ Copy-to-clipboard with 2-second notification
- ✅ Terminal commands extraction ($ prefix)
- ✅ Dedicated code/terminal panel

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
my-app/
├── app/
│   ├── page.tsx              # Main chat interface (~1000 lines)
│   ├── game/page.tsx         # Ping Pong game page
│   ├── settings/page.tsx     # Settings page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       ├── route.ts          # OpenAI chat endpoint
│       ├── creative/route.ts # (Unused)
│       └── mentor/route.ts   # (Unused)
│
├── components/
│   ├── CommandTerminal.tsx   # Terminal display component
│   ├── OrbCanvas.tsx         # (Depreciated - not used)
│   └── PingPongGame.tsx      # Ping Pong game (legacy)
│
├── hooks/
│   ├── useSpeechRecognition.ts  # Handles microphone input
│   └── useAudioPlayer.ts        # Handles audio playback
│
├── utils/
│   ├── apiClient.ts          # OpenAI API communication
│   ├── messageParser.ts      # Extracts code/commands from AI responses
│   ├── themes.ts             # Voice theme definitions
│   └── codeProcessor.ts      # Code processing utilities
│
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
- **`/game`** - Ping Pong game (triggered by "ping pong" keyword)

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

See [Troubleshoot.md](./Troubleshoot.md) for detailed debugging guides.

Common issues:
- Speech recognition not working? Check microphone permissions
- No AI responses? Check OpenAI API key in `.env.local`
- Code not showing? Ensure AI response contains code blocks with backticks

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
