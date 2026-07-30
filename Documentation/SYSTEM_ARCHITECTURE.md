# Loco System Architecture

> Last Updated: March 31, 2026

> In plain terms: this document explains how Loco is currently put together across application orchestration, database design, model usage, and infrastructure.

## 1. Executive Summary

Loco is a Next.js application with one primary interactive surface: a voice-enabled chat workspace. The frontend runs in the browser or inside an Electron shell. The backend is implemented as Next.js App Router API routes. Persistence is handled through Prisma against PostgreSQL. External capabilities are provided by OpenAI, Google Calendar, YouTube, and optional Gemini fallback services.

At a system level, Loco is organized into four layers:

1. Application orchestration
2. Database and persistence
3. Model and AI/provider layer
4. Infrastructure and runtime

The current architecture is modular, but still concentrated around one main orchestration entrypoint: `app/api/route.ts`.

---

## 2. System Overview

```mermaid
flowchart LR
    User[User]\nText or Voice --> UI[Next.js UI\napp/page.tsx]
    UI --> API[Main API Orchestrator\napp/api/route.ts]
    UI --> Sessions[Session API\napi/chat-sessions]
    UI --> STT[STT API\napi/stt]
    API --> Memory[Memory Builders\nchatMemory.ts assistantMemory.ts]
    API --> Attachments[Attachment Context\nattachmentContext.ts]
    API --> Calendar[Google Calendar Service\ngoogleCalendar.ts]
    API --> OpenAI[OpenAI Chat / TTS / STT]
    STT --> OpenAI
    STT --> Gemini[Gemini Fallback STT]
    Memory --> Prisma[Prisma Client]
    Sessions --> Prisma
    Calendar --> Prisma
    Prisma --> Postgres[(PostgreSQL / Neon)]
    Calendar --> Google[Google OAuth + Calendar API]
    UI -. optional desktop shell .-> Electron[Electron Overlay Runtime]
```

---

## 3. Application Orchestration

## 3.1 Frontend Entry Points

The primary user experience lives in `app/page.tsx`.

That screen is responsible for:

- collecting text input
- collecting voice input through browser speech recognition or Electron audio capture
- managing local UI state for messages, preview panels, audio playback, and saved sessions
- posting chat requests through `tools/hooks/utils/apiClient.ts`
- parsing assistant replies into chat text, code blocks, commands, and previewable artifacts

The frontend sends a chat payload to `/api` with the current messages, selected voice, session ID, attachments, preview runtime issue state, and client time zone.

Related frontend orchestration pieces:

- `tools/hooks/useSpeechRecognition.ts` handles browser speech and Electron recording flows
- `tools/hooks/useAudioPlayer.ts` handles playback and replay behavior
- `tools/hooks/utils/apiClient.ts` standardizes request shape, timeout, and retry behavior
- `app/settings/page.tsx` manages integration state and user-selected runtime preferences

## 3.2 Main Backend Orchestrator

The core server orchestration happens in `app/api/route.ts`.

This route acts as a controller plus workflow engine. Its responsibilities include:

- validating the request
- identifying the latest user message
- short-circuiting specialized intents before normal chat generation
- building memory and attachment context
- generating an AI response
- reviewing that response in a second pass
- optionally revising the response once if quality checks fail
- optionally synthesizing audio for the response
- returning the final payload to the UI

## 3.3 Specialized Request Branches

Before standard chat generation, the main route handles several feature-specific paths:

- assistant memory recall
- assistant memory write
- calendar draft confirmation and cancellation
- live Google Calendar read and delete flows
- attachment-aware prompting
- preview-error-aware correction flow

This matters architecturally because Loco is not a single raw LLM call. It is a rule-guided orchestration layer that decides whether the message should trigger a tool-like workflow first.

## 3.4 Context Assembly

For standard chat requests, the route builds a composite prompt from multiple sources:

- recent in-memory chat messages from the request
- saved persistent conversation history from `lib/chatMemory.ts`
- relevant long-term user facts from `lib/assistantMemory.ts`
- attachment-derived context from `lib/attachmentContext.ts`
- runtime preview failure context from the UI if the last preview crashed
- formatted source code and summarized code context when code is present

This is one of the stronger parts of the current architecture. The prompt is assembled from both transient and persistent context rather than relying only on the latest message.

## 3.5 Response Pipeline

The main response path is multi-pass:

1. First generation pass via OpenAI chat completions
2. Internal review pass via `reviewLocoResponse()`
3. Optional single revision pass if the review says the answer is weak or likely broken
4. Optional TTS generation if server-side TTS is enabled

This gives Loco a QA loop inside the API route. The tradeoff is extra latency, but the intent is higher answer quality and fewer broken code replies.

## 3.6 Session Orchestration

Conversation persistence is separated from the main chat route.

`app/api/chat-sessions/route.ts` is responsible for:

- listing saved sessions
- saving sessions
- clearing all sessions

The persistence layer is intentionally tolerant of database outages. If Prisma cannot reach the database, the app degrades gracefully by returning empty sessions or a 503 persistence-specific response instead of crashing the entire experience.

## 3.7 Desktop Orchestration

Electron is an optional runtime shell rather than a separate backend.

In Electron mode:

- the same Next.js app remains the UI and API surface
- Electron adds overlay behavior, global shortcuts, and native integration
- voice capture can switch from browser-native recognition to recorded audio sent to the STT route

This is a pragmatic architecture: one application, two runtimes.

---

## 4. Database Architecture

## 4.1 Persistence Stack

The database layer uses:

- Prisma ORM
- PostgreSQL as the data store
- a shared singleton Prisma client in `lib/prisma.ts`
- Prisma migrations in `prisma/migrations`

The database connection is environment-driven through `DATABASE_URL`.

## 4.2 Database Responsibilities

The database is not used only for chat history. It currently stores several categories of application state:

- saved conversation sessions and messages
- long-term assistant memory
- Google Calendar OAuth connection state
- pending calendar drafts
- remembered created calendar events
- YouTube OAuth connection state
- workforce/rubric assessment domain data

This means Loco is already evolving beyond a pure chat assistant into a broader stateful application.

## 4.3 Core Schema Groups

### A. User and Connection Records

- `User`
- `GoogleCalendarConnection`
- `YouTubeConnection`

These models store identity-adjacent and integration state. At present, the integration records appear effectively single-tenant at the application level because they are unique by provider rather than scoped to a user account.

### B. Conversation and Memory Records

- `ConversationSession`
- `ConversationMessage`
- `AssistantMemory`
- `CalendarEventMemory`
- `PendingCalendarDraft`

This is the main persistence backbone for Loco’s assistant behavior.

Important design characteristics:

- sessions own ordered messages
- session deletion cascades through messages
- calendar memories can stay alive even if a session is removed
- assistant memory is normalized to prevent duplicate fact storage
- pending drafts preserve state across confirmation turns

### C. Workforce Domain Records

- `WorkforceMember`
- `WorkforceArea`
- `WorkforceCompetency`
- `WorkforceRubricLevel`
- `WorkforceAssessment`
- `WorkforceEvidenceLink`

These models represent a second product domain living in the same database. They are structurally separate from the chat assistant domain.

## 4.4 Data Access Pattern

The codebase mostly follows a light service-module pattern rather than a heavy repository abstraction.

Examples:

- `lib/chatMemory.ts` manages session and calendar-memory persistence
- `lib/assistantMemory.ts` manages long-term fact persistence and recall
- `lib/googleCalendar.ts` persists OAuth tokens and mirrors created/deleted events into local memory
- `lib/persistence.ts` centralizes database availability checks

This is a reasonable middle ground for the current scale. The code keeps route handlers thinner than direct inline Prisma usage everywhere, but it has not yet introduced a more formal domain-service boundary.

## 4.5 Current Database Strengths

- clear separation between session history and assistant memory
- pragmatic use of indexes and unique constraints
- graceful error handling for transient database outages
- persistent draft state for multi-turn calendar workflows

## 4.6 Current Database Constraints

- integration records are not yet obviously user-scoped, which limits multi-user isolation
- chat, integrations, and workforce data all share one schema boundary
- token storage is persisted in the database, so operational security depends on environment and database controls rather than application-level encryption shown in code

---

## 5. Model Architecture

## 5.1 What “Model” Means in This App

In Loco, the model layer is not one model. It is a provider matrix across different jobs:

- chat generation
- internal review
- text-to-speech
- speech-to-text
- intent parsing support through prompted chat behavior

## 5.2 Current Primary Model Path

The verified primary model path in `app/api/route.ts` is OpenAI-first.

Current observed behavior:

- chat generation uses OpenAI chat completions
- the default model is `gpt-4o-mini` unless overridden by `OPENAI_MODEL`
- the internal QA reviewer also uses OpenAI chat completions in JSON mode
- optional server-side TTS can use OpenAI `tts-1`
- the STT route tries multiple OpenAI transcription models first

So architecturally, OpenAI is currently the primary reasoning and speech provider for the main assistant runtime.

## 5.3 Fallback and Auxiliary Providers

Gemini is used as a fallback or optional provider, not the primary chat engine in the verified route path.

Current Gemini roles:

- speech-to-text fallback in `app/api/stt/route.ts`
- optional server-side TTS path when `TTS_PROVIDER=gemini`

Browser-native speech and browser-native TTS are also part of the model layer in practice, because they replace paid provider calls in some runtime modes.

## 5.4 Model-Orchestrated Quality Control

One notable architectural pattern is that the app uses a second model call to review the first model’s output.

That means the system is doing:

- generation
- evaluation
- optional revision

This is closer to a small inference pipeline than a one-shot chatbot design.

## 5.5 Assistant Routing State

The frontend and settings UI expose assistant-routing concepts such as:

- `auto`
- `loco`
- `claude`

`POST /api` consumes `assistantMode` through `lib/assistant/routing.ts`:

- `loco` → OpenAI
- `claude` → Claude when `CLAUDE_API_KEY` is set, otherwise OpenAI with `fallbackReason`
- `auto` → Claude for code/game heuristics when available, otherwise OpenAI

The response includes a `routing` object matching the client contract in `tools/hooks/utils/apiClient.ts`.

## 5.6 Model Layer Strengths

- multi-pass answer quality control
- provider fallback for speech transcription
- browser-native options reduce cost for audio features
- environment-variable-based model selection keeps runtime flexible

## 5.7 Model Layer Constraints

- the main orchestration route is becoming large and is carrying both prompt engineering and workflow logic
- model routing appears partially represented in UI/docs and should be verified or completed end to end
- generation, review, and TTS in one request path can increase response latency and operational cost

---

## 6. Infrastructure Architecture

## 6.1 Runtime Modes

Loco currently supports two practical runtime shapes:

### A. Local or self-hosted Docker runtime

Defined by:

- `Dockerfile`
- `docker-compose.yml`
- `docker-entrypoint.sh`

This mode runs:

- a Next.js app container
- a PostgreSQL 15 container

The app waits for the database health check, then starts, generates Prisma client code, and applies Prisma migrations on container startup.

### B. Direct app runtime against managed Postgres

The codebase and environment setup also support pointing Prisma at a managed PostgreSQL database such as Neon via `DATABASE_URL`.

This is already reflected in the local environment example and app documentation.

## 6.2 Container Design

The Docker image uses a multi-stage build:

1. Builder stage installs dependencies and generates Prisma client
2. Next.js production build runs
3. Dev dependencies are pruned
4. Runtime image copies only the built app, production modules, Prisma assets, and entrypoint

Important runtime details:

- OpenSSL and CA certificates are installed because Prisma depends on correct SSL libraries
- the runtime image includes health checks
- container startup runs `prisma migrate deploy`

This is a sensible production-oriented container setup for a Next.js plus Prisma application.

## 6.3 Networking and Service Composition

In Docker Compose:

- the app and db share a private bridge network
- the app reaches Postgres using the service name `db`
- the app is exposed externally on port 80 mapped to internal port 3000
- the database is exposed on port 5432

This setup is straightforward and appropriate for local deployment, small-server deployment, or basic CI environments.

## 6.4 Operational Dependencies

The application currently depends on these external services at runtime when enabled:

- OpenAI APIs
- Google Calendar OAuth and Calendar APIs
- YouTube APIs and OAuth endpoints
- Gemini APIs for optional fallback STT/TTS
- PostgreSQL or Neon for persistence

This means Loco is operationally a connected application, not an offline-first one.

## 6.5 Secrets and Configuration

Infrastructure and model behavior are controlled through environment variables such as:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GEMINI_API_KEY`
- `APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

The architectural rule is correct: secrets live in environment variables, not client code.

## 6.6 Infrastructure Strengths

- one codebase supports browser and Electron runtimes
- one Docker setup supports reproducible local deployment
- Prisma migration deploy is built into container startup
- managed Postgres and local Postgres are both supported

## 6.7 Infrastructure Constraints

- migration execution on every startup is convenient but should be controlled carefully in scaled multi-instance deployments
- app and database are coupled in the local Compose topology, which is fine for small deployments but not a final production topology
- there is no dedicated queue, cache, or worker tier yet

---

## 7. Architectural Assessment

## 7.1 What Is Working Well

- The app has a clear center of gravity: one chat UI, one main orchestrator, one persistence stack.
- Context assembly is stronger than a typical simple chatbot because it combines live context, persistent memory, and runtime feedback.
- The persistence layer degrades gracefully when the database is unavailable.
- Docker support is production-aware enough for a small team workflow.

## 7.2 Where the Architecture Is Starting to Stretch

- `app/api/route.ts` is becoming a monolith and now contains orchestration, prompt design, business rules, and feature branching in one place.
- The database contains multiple product domains in a shared schema without a stronger domain boundary.
- Model routing and workflow metadata appear more mature in UI/docs than in the currently verified server entry path.

## 7.3 Recommended Next Architectural Moves

Status as of July 30, 2026:

1. **Done** — Split helpers out of `app/api/route.ts` into `lib/orchestration/*` (calendar heuristics, request heuristics, review, OpenAI transport) while keeping `POST` as the sequencer.
2. **Done** — Provider abstraction in `lib/providers` for chat, TTS, and STT (`chat.ts`, `tts.ts`, `stt.ts`).
3. **Done** — User scoping on `GoogleCalendarConnection` and `YouTubeConnection` via `userId` + default app user (`lib/assistant/appUser.ts`).
4. **Done** — Workforce service boundary in `lib/workforce` (separate from chat orchestration; schema still shared).
5. **Done** — `assistantMode` is consumed by `POST /api` through `lib/assistant/routing.ts` and returned as `routing` metadata.

---

## 8. Key Files

- `app/page.tsx` - main user interaction surface
- `app/api/route.ts` - primary orchestration route
- `app/api/chat-sessions/route.ts` - session persistence API
- `app/api/stt/route.ts` - speech-to-text orchestration
- `lib/chatMemory.ts` - conversation and calendar memory persistence
- `lib/assistantMemory.ts` - long-term assistant memory persistence
- `lib/googleCalendar.ts` - Google OAuth and Calendar integration service
- `lib/prisma.ts` - shared Prisma client
- `lib/persistence.ts` - database availability detection
- `prisma/schema.prisma` - data model definition
- `Dockerfile` - container image build
- `docker-compose.yml` - local service orchestration
- `docker-entrypoint.sh` - runtime bootstrap and migration execution

---

## 9. Bottom Line

Loco’s current architecture is a stateful AI application built around a Next.js orchestration core, Prisma-backed persistence, OpenAI-centered model usage, and a practical Docker plus Postgres runtime.

It is already beyond a simple chatbot. It has real workflow orchestration, persistence, external integrations, and multi-runtime support.

The main architectural risk is not that the system lacks structure. It is that more and more responsibilities are accumulating inside the central route and shared database without the next round of service boundary cleanup.

That cleanup is the natural next step.