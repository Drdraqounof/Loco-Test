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
- Node.js 18 or higher
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))
- A modern web browser

### Installation

```bash
# Clone and navigate
git clone <repository-url>
cd my-app

# Install dependencies
npm install

# Create environment file
echo "OPENAI_API_KEY=your_actual_key_here" > .env.local
```

### Run Loco

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build
npm run start
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

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
