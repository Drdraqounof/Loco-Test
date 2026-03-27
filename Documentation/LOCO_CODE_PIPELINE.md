# Loco Code Pipeline

> **Last Updated:** March 11, 2026 at 3:42 PM

> **In plain terms:** This doc explains how a coding request moves through Loco from the user's prompt to the final answer.

## 1. Purpose

This document explains how Doco handles code-oriented requests from the moment a user sends a prompt to the moment the response is shown in the app preview panel.

It focuses on the current pipeline implemented in:

- `my-app/app/api/route.ts`
- `my-app/app/page.tsx`
- `my-app/tools/hooks/utils/apiClient.ts`

---

## 2. High-Level Flow

```text
1. User sends a prompt
   ↓
2. Frontend posts chat request to /api
   ↓
3. Server builds context
   - recent messages
   - saved memory
   - relevant past conversation
   - attachments
   - preview runtime errors, if any
   ↓
4. Loco generates a first draft
   ↓
5. Internal review prompt checks:
   - does it answer the user request?
   - does it likely work?
   - does it need revision?
   ↓
6. If review fails, Loco performs one revision pass
   ↓
7. Final response returns to frontend
   ↓
8. Frontend extracts code, commands, and previewable content
   ↓
9. Preview iframe runs the generated code
   ↓
10. If preview fails, error is captured and sent back on the next request
```

---

## 3. Frontend Pipeline

### 3.1 Request Entry

The main chat UI lives in `my-app/app/page.tsx`.

When the user submits a prompt:

1. The message is appended to the local chat state.
2. The current session is persisted through `/api/chat-sessions`.
3. The frontend calls `callAIAPI()` from `my-app/tools/hooks/utils/apiClient.ts`.

The request body currently includes:

- `messages`
- `voice`
- `sessionId`
- `attachments`
- `previewRuntimeIssue`
- `language`
- `topic`
- `timeZone`

### 3.2 Preview Capture

After Loco responds, the frontend:

1. Parses markdown/code blocks from the assistant reply.
2. Builds the workspace preview panel.
3. Renders previewable code inside an iframe using `srcDoc`.

The preview layer now includes an error bridge that posts messages back to the parent window when:

- a runtime error occurs
- an unhandled promise rejection occurs

Those errors are stored in UI state as `previewRuntimeIssue`.

### 3.3 Feedback Loop

If preview code fails:

1. The error is shown in the UI.
2. The next user send includes that captured error automatically.
3. Loco receives that runtime feedback as part of the next `/api` request.

This gives the model a real correction signal instead of forcing it to guess why the preview failed.

---

## 4. Server Pipeline

The server pipeline is implemented in `my-app/app/api/route.ts`.

### 4.1 Pre-Processing

Before the main coding response is generated, the route may handle specialized flows such as:

- assistant memory recall
- assistant memory write
- Google Calendar read/create/delete flows

If the request is a normal coding or chat request, the route continues into the Loco response pipeline.

### 4.2 Context Assembly

The route gathers supporting context from multiple places:

- persistent conversation memory
- relevant assistant memory
- relevant prior conversation snippets
- attachment prompt context
- captured preview runtime error context

This context is merged into the system and recent message prompt sequence.

### 4.3 First Generation Pass

The first generation pass uses the main Loco system prompt and recent conversation context.

Helper used:

- `callOpenAIChat()`

The first pass produces the initial draft response that the user would normally see.

### 4.4 Internal Review Pass

After the first draft is generated, a second internal prompt reviews the answer.

Helper used:

- `reviewLocoResponse()`

The review checks:

- whether the answer matches the latest user request
- whether the answer is likely to work
- whether the answer should be approved as-is
- what should be fixed if revision is needed

The review returns structured JSON with:

- `approved`
- `matchesUserRequest`
- `worksLikely`
- `updatedUserQuery`
- `reviewerNotes`
- `fixes`

### 4.5 Revision Pass

If the internal review does not approve the answer, the route performs one revision pass.

The revision prompt includes:

- the original user request
- the updated user query from the reviewer
- reviewer notes
- required fixes

The revised answer then becomes the final response returned to the frontend.

### 4.6 Pipeline Metadata

The API response now includes pipeline metadata alongside the assistant message.

Current fields:

- `approved`
- `matchesUserRequest`
- `worksLikely`
- `updatedUserQuery`
- `reviewerNotes`
- `fixes`

This metadata is useful for future UI instrumentation, analytics, or persistence.

---

## 5. Preview Behavior

The workspace preview is not a full project build system.

It is a lightweight sandbox intended for:

- self-contained HTML/CSS/JS snippets
- SVG previews
- React-style snippets that can be rendered inside the iframe runtime

### Important Limitation

The preview does not currently run a real package install or project bundler.

That means code which depends on:

- npm installs
- local file imports
- a real Vite/Next/Webpack build step
- asset pipelines

may still fail in preview even if it would work in a proper project.

---

## 6. Failure Handling

### 6.1 Frontend Failure Handling

If `/api` fails:

- the chat no longer fails silently
- the user sees an assistant error message in the conversation

### 6.2 Review Failure Handling

If the internal reviewer returns malformed JSON:

- the server catches the parse failure
- the pipeline falls back to a default revision instruction
- the request does not crash solely because the reviewer output was malformed

### 6.3 Preview Failure Handling

If preview code throws at runtime:

- the iframe reports the error to the parent UI
- the UI stores the error
- the next request sends that error back to Loco

---

## 7. Performance Notes

The current code pipeline trades some speed for higher answer quality.

### Why Some Requests Are Slower

For code-heavy requests, the route may perform:

1. context gathering
2. first LLM generation
3. internal review generation
4. revision generation

That means some requests are effectively multi-pass instead of single-pass.

### Current Speed Tradeoff

- Better answer checking
- Better correction of failed preview code
- Slower total response time than a single LLM call

---

## 8. Current Gaps

The following pieces are not yet part of the current pipeline:

- real terminal/build execution as part of the automatic review loop
- persistent storage of `updatedUserQuery` and reviewer results in the database
- automatic internet retrieval inside the correction loop for general coding requests
- package installation or dependency resolution inside the preview system

---

## 9. Recommended Next Steps

If Loco should become more reliable for larger coding tasks, the next useful upgrades are:

1. Persist pipeline review data in Prisma.
2. Add conditional fast-path logic so normal chat skips the review pass.
3. Add a real build/test runner for code responses that require dependencies.
4. Add dependency-aware preview handling for common libraries such as Three.js and Chart.js.
5. Add UI indicators showing whether a response passed review or was auto-revised.

---

## 10. Summary

Loco now uses a real code-oriented response pipeline, not just a single LLM call.

The current system:

- generates a first answer
- reviews it internally
- revises it once if needed
- renders code in a workspace preview
- captures preview runtime errors
- feeds those errors back into the next correction pass

That gives Loco a stronger correction loop for code generation while staying inside the existing Next.js app architecture.