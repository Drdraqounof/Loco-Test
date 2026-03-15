# Loco Coding Knowledge Base

> Last Updated: March 15, 2026 at 04:08 PM EDT

## Purpose

This document defines the baseline coding standards Loco should follow when generating, editing, debugging, or reviewing software in this workspace.

It is intended to make Loco more consistent across frontend, backend, game, and debugging tasks while still respecting the existing repo architecture.

## Core Development Principles

### General Rules

- Write clean, readable code.
- Prefer simple solutions over complex ones.
- Follow consistent naming conventions.
- Use comments only when the logic is not obvious.
- Avoid repeating logic.
- Validate inputs and handle errors gracefully.

### Architecture Principles

- Separate concerns between UI, logic, and data.
- Keep components small and reusable.
- Prefer modular file structure.
- Use environment variables for secrets.
- Follow existing repo patterns before introducing new architecture.

## Frontend Development Standards

### Preferred Stack

For modern web work in Loco, the default preference is:

- Framework: Next.js App Router or React, depending on the existing project
- Language: TypeScript
- Styling: Tailwind CSS or the current repo styling system
- State management: React hooks or Context API unless a heavier solution is justified

### Repo-Specific Frontend Note

This repository already uses Next.js App Router under `my-app/app`, not a classic `/src/pages` layout.

That means Loco should prefer the current repo structure over generic templates.

Typical frontend areas in this repo:

```text
my-app/app
my-app/components
my-app/tools/hooks
my-app/lib
```

### Component Design Rules

Good components should:

- Do one job only
- Be reusable
- Accept props instead of hardcoded data
- Keep heavy business logic outside rendering when practical

Example:

```tsx
type ButtonProps = {
  label: string;
  onClick: () => void;
};

export default function Button({ label, onClick }: ButtonProps) {
  return (
    <button
      className="px-4 py-2 rounded bg-blue-500 text-white"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

### Frontend Best Practices

Loco should prefer to:

- Use functional components
- Use hooks instead of classes
- Use async and await for API calls
- Handle loading and error states
- Avoid unnecessary rerenders
- Keep logic out of UI when possible
- Match the repo's visual and structural conventions instead of defaulting to generic layouts

Example API call:

```ts
export async function fetchUsers() {
  try {
    const response = await fetch("/api/users");
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch users", error);
    return null;
  }
}
```

## Backend Development Standards

### Preferred Stack

In general, Loco should prefer:

- Runtime: Node.js
- Language: TypeScript
- Database: PostgreSQL or MongoDB when applicable

### Repo-Specific Backend Note

This repository primarily uses Next.js route handlers in `my-app/app/api` rather than a standalone Express server.

That means Loco should default to App Router route handlers here unless the user explicitly asks for a separate Express service.

Typical backend areas in this repo:

```text
my-app/app/api
my-app/lib
my-app/prisma
```

### Backend Architecture

Loco should keep backend logic layered where complexity justifies it:

- Route layer for HTTP handling
- Helper or service layer for business logic
- Data layer for Prisma or other persistence access

Thin route handlers are preferred when possible.

### Example API Endpoint Pattern

```ts
export async function GET() {
  try {
    const users = await userService.fetchUsers();

    return Response.json({
      success: true,
      data: users,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: "Server error",
      },
      { status: 500 }
    );
  }
}
```

### API Design Rules

- Use REST-style principles when they fit the feature.
- Keep route naming predictable.
- Return success and error responses consistently.
- Use appropriate status codes.

Preferred response shapes:

```ts
{
  success: true,
  data: {}
}
```

or

```ts
{
  success: false,
  error: "message"
}
```

## Security Rules

Loco should always enforce or preserve:

- Input validation
- Environment variables for secrets
- Authentication checks where required
- Proper error handling
- Safe response messages that do not leak internal details

Loco should never expose:

- API keys
- Database credentials
- Secret tokens

## Performance Best Practices

### Frontend

- Lazy load when it improves the experience
- Optimize images and heavy assets
- Use memoization only when justified by actual rerender cost

### Backend

- Avoid unnecessary queries
- Cache when it clearly fits the access pattern
- Use async processing for heavy work when appropriate

## Debugging Strategy

When debugging, Loco should:

1. Identify the exact error message.
2. Locate the failing file or layer.
3. Check inputs and outputs.
4. Review recent relevant changes.
5. Suggest minimal fixes first.
6. Prefer root-cause fixes over cosmetic patches.

## Code Review Checklist

Before returning or accepting code, Loco should check:

- Does the code build or typecheck?
- Are variables clearly named?
- Are error paths handled?
- Is logic separated correctly?
- Does the implementation fit the repo architecture?
- Is the code reasonably scalable?

## Relationship To Other Instruction Files

This knowledge base is the general baseline.

More specialized files should override or refine it when relevant:

- `frontend-design.instructions.md` for distinctive UI quality
- `game-design.instructions.md` for game-specific interaction and presentation rules
- `AI_WORKFLOW.md` for routing, retrieval, planning, review, and confidence gating
