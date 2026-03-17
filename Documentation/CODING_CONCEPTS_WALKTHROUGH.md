# Coding Concepts Walkthrough

> **Last Updated:** March 17, 2026
>
> **In plain terms:** This document explains how I use core coding concepts in Loco and how those concepts help make the app work better.

## Purpose

This write-up is meant to help me explain my project in simple language.

If someone asks how I use core programming concepts like variables, conditionals, loops, functions, and Prisma, I can use this document to walk them through real examples from my app instead of giving a generic definition.

## Simple Summary

Loco is not just one big file.
It works because different coding concepts each do a specific job:

- variables store information the app needs
- conditionals help the app make decisions
- loops help the app repeat actions without rewriting the same code
- functions break large problems into smaller reusable pieces
- Prisma schema defines how data is organized in the database
- Prisma queries let the app save, load, update, and delete data

## 1. Variables

### What a variable means in plain terms

A variable is a named container for information.
It lets me store something now and use it later.

### How I use variables in this project

In the main chat API, I store important settings in variables like:

- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `AI_PROVIDER`
- `TTS_PROVIDER`

These are in [app/api/route.ts](app/api/route.ts).

On the frontend, I also use state variables in [app/page.tsx](app/page.tsx), such as:

- `voice`
- `userMessage`
- `chatHistory`
- `autoPlayAudio`
- `youTubePlayer`

### Why this matters

Variables make the app flexible.
Instead of hardcoding everything, I can store values once and update them as the user interacts with the app.

### How this shows optimization

Using variables helps avoid repetition.
For example, storing provider names and environment settings once means I do not have to rewrite the same values all over the file.
That makes the code easier to maintain and less error-prone.

## 2. Conditionals

### What conditionals mean in plain terms

Conditionals are decision-makers.
They let the program ask questions like:

- if this is true, do one thing
- otherwise, do something else

### How I use conditionals in this project

In [lib/googleCalendar.ts](lib/googleCalendar.ts), I use conditionals to decide things like:

- if the user is not connected to Google Calendar, return `null`
- if the saved token is about to expire, refresh it
- if there is no refresh token, skip the refresh logic

In [app/api/route.ts](app/api/route.ts), conditionals help decide:

- whether the request is about memory
- whether the user is asking for calendar help
- whether a draft response needs review
- whether the answer should be regenerated

### Why this matters

The app should not react the same way to every input.
Conditionals let the app respond differently depending on the user's request, saved data, or current state.

### How this shows optimization

Conditionals help avoid unnecessary work.
For example, if a calendar connection does not exist, the app stops early instead of trying to call Google anyway.
That saves time and prevents errors.

## 3. Loops

### What loops mean in plain terms

A loop repeats an action without me having to write the same code again and again.

### How I use loops in this project

In [app/page.tsx](app/page.tsx), I use array methods and repeated mapping logic to build UI data such as prompt suggestions, particles, and displayed content.

In [lib/chatMemory.ts](lib/chatMemory.ts), loops are used when building memory context from saved sessions and events.
For example, the code goes through saved sessions and builds readable summaries.

In [app/api/route.ts](app/api/route.ts), the app also works through arrays of messages, resources, and review fixes.

### Why this matters

Without loops, I would need to manually write the same logic many times.
That would make the code longer and harder to update.

### How this shows optimization

Loops make the code more efficient and reusable.
Instead of writing ten separate pieces of code for ten items, I can write one loop that handles all of them.
That reduces file size, keeps logic consistent, and makes future updates easier.

## 4. Functions

### What functions mean in plain terms

A function is a reusable set of instructions.
Instead of rewriting the same logic over and over, I can place it in one function and call it whenever I need it.

### How I use functions in this project

In [lib/googleCalendar.ts](lib/googleCalendar.ts), functions like these each have one clear job:

- `requireEnv()` checks that required environment variables exist
- `getGoogleOAuthConfig()` prepares Google OAuth settings
- `createOAuthClient()` creates the Google client
- `createCalendarEvent()` creates a new event
- `listCalendarEvents()` loads saved calendar events

In [app/api/route.ts](app/api/route.ts), functions like these help structure the AI workflow:

- `normalizeModelOutput()` cleans model output
- `callOpenAIChat()` sends a request to OpenAI
- `parsePipelineReviewResult()` checks and cleans review data
- `reviewLocoResponse()` helps validate generated responses

### Why this matters

Functions make the project easier to understand.
Each function handles one part of the job instead of putting all logic into one giant block.

### How this shows optimization

Functions improve reuse and readability.
If I need the same logic in more than one place, I can call the same function instead of copying and pasting code.
That saves time and reduces bugs.

## 5. Prisma Schema

### What Prisma schema means in plain terms

The Prisma schema is the blueprint for the database.
It tells the app:

- what tables exist
- what fields each table has
- how those tables connect to each other

### How I use it in this project

In [prisma/schema.prisma](prisma/schema.prisma), I define models such as:

- `ConversationSession`
- `ConversationMessage`
- `CalendarEventMemory`
- `AssistantMemory`
- `WorkforceArea`
- `WorkforceCompetency`
- `WorkforceAssessment`

For example:

- `ConversationSession` stores a saved chat session
- `ConversationMessage` stores each message in that session
- `WorkforceCompetency` stores rubric skills and questions
- `WorkforceAssessment` stores ratings connected to a person and skill

### Why this matters

The schema gives structure to the app's data.
Without it, the app would not know how to store conversations, events, or workforce ratings in a reliable way.

### How this shows optimization

A good schema keeps data organized and reduces confusion.
Using relationships, indexes, and unique fields helps the app find information faster and prevents duplicate or broken data.

## 6. Prisma Queries

### What Prisma queries mean in plain terms

Prisma queries are the commands I use to talk to the database.
They let me:

- create new records
- find records
- update records
- delete records

### How I use them in this project

In [lib/chatMemory.ts](lib/chatMemory.ts), I use Prisma queries such as:

- `findMany()` to load saved chat sessions
- `create()` to save new records
- `createMany()` to save many messages at once
- `deleteMany()` to remove messages or sessions
- `upsert()` to update existing data or create it if it does not exist
- `$transaction()` to group related database actions safely

In [lib/googleCalendar.ts](lib/googleCalendar.ts), I use queries such as:

- `findUnique()` to check whether a Google connection already exists
- `upsert()` to save or update tokens
- `deleteMany()` to disconnect the account

### Why this matters

The app needs to remember things.
Prisma queries are how I make that happen.
They let the app store user state and bring it back later.

### How this shows optimization

Using Prisma keeps database code cleaner and safer than writing raw SQL everywhere.
Using transactions also protects data integrity by making sure related steps happen together.

## 7. How These Concepts Work Together

These concepts are strongest when they work together, not separately.

A real example from this project:

1. A user sends a message.
2. Variables store that message and the current settings.
3. Conditionals decide what kind of request it is.
4. Functions break the job into smaller steps.
5. Loops help process repeated data like messages or matches.
6. Prisma queries save or retrieve the needed data.
7. The schema makes sure that data is stored in the right structure.

That is how a full feature is built from multiple smaller coding concepts.

## 8. How I Am Optimizing My Code

When I explain optimization in this project, I mean I am trying to make the code:

- easier to read
- easier to reuse
- easier to update
- less repetitive
- safer when working with data

Examples from Loco:

- I separate logic into functions instead of one giant block.
- I use conditionals to avoid unnecessary API calls and work.
- I use loops and array methods to avoid repeating code.
- I use Prisma relationships and queries so data is structured and easier to manage.
- I use helper files like [lib/chatMemory.ts](lib/chatMemory.ts) and [lib/googleCalendar.ts](lib/googleCalendar.ts) so the code stays organized.

## 9. Questions My Teacher Might Ask

### How do you use variables in your project?

I use variables to store things like API settings, user messages, voice settings, and database values. They help the app keep track of information and reuse it when needed.

### How do you use conditionals?

I use conditionals to let the app make decisions. For example, the app checks if a user is connected to Google Calendar, if a token needs refreshing, or if a request should be handled as memory, chat, or calendar logic.

### How do you use loops?

I use loops and array methods to process repeated data like chat messages, saved sessions, resource lists, and UI items. This saves me from writing the same code over and over.

### How do you use functions?

I use functions to separate large tasks into smaller reusable pieces. For example, one function checks environment variables, another creates a calendar client, and another saves chat data.

### How do you use Prisma schema?

I use Prisma schema as the blueprint for the database. It defines the tables, fields, and relationships that store conversations, calendar data, assistant memory, and workforce ratings.

### How do you use Prisma queries?

I use Prisma queries to create, read, update, and delete records. This is how my app saves sessions, stores memory, connects integrations, and manages rating data.

### How are you optimizing your code?

I optimize by reducing repetition, organizing code into functions, using structured database models, and making the app do only the work it needs to do.

## 10. Final Explanation I Can Say Out Loud

If I had to explain it simply, I would say:

"In my project, I use variables to store information, conditionals to make decisions, loops to handle repeated tasks, and functions to organize reusable logic. I use Prisma schema to design the database and Prisma queries to interact with it. Together, these concepts help me build a project that is more organized, easier to maintain, and better optimized."

## 11. Files I Can Reference While Presenting

If I need to point to real examples, I can mention:

- [app/page.tsx](app/page.tsx) for variables, state, and frontend logic
- [app/api/route.ts](app/api/route.ts) for conditionals, functions, and workflow logic
- [lib/googleCalendar.ts](lib/googleCalendar.ts) for functions, conditionals, and Prisma-backed integration work
- [lib/chatMemory.ts](lib/chatMemory.ts) for loops, functions, and Prisma queries
- [prisma/schema.prisma](prisma/schema.prisma) for database design

That gives me both a technical answer and a simple answer depending on who is asking.

## 12. Exact Code Examples I Can Show

This section gives me real snippets I can point to if my teacher asks me to show the concepts in actual code.

### Variables Example

From [app/api/route.ts](app/api/route.ts):

```ts
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || "openai";
const TTS_PROVIDER = process.env.TTS_PROVIDER || "openai";
const LIVE_CALENDAR_DELETE_MARKER = "Google Calendar delete confirmation ready.";
```

Plain-English explanation:
These variables store important settings and values the app needs while it is running.

### Conditionals Example

From [lib/googleCalendar.ts](lib/googleCalendar.ts):

```ts
if (!connection) {
	return null;
}

if (!connection.refreshToken) {
	return {
		auth: oauth2Client,
		calendar: google.calendar({ version: "v3", auth: oauth2Client }),
		connection,
	};
}

if (expiresSoon) {
	const refreshed = await oauth2Client.refreshAccessToken();
	const credentials = refreshed.credentials;
	if (credentials.access_token) {
		await saveCalendarConnection({
			accessToken: credentials.access_token,
			refreshToken: credentials.refresh_token || connection.refreshToken,
			expiryDate: credentials.expiry_date || null,
			scope: credentials.scope || connection.scope,
			email: connection.email,
		});
	}
}
```

Plain-English explanation:
These conditionals help the app decide what to do based on the current connection state.

### Loops Example

From [lib/chatMemory.ts](lib/chatMemory.ts):

```ts
if (recentSessions.length > 0) {
	sections.push("Recent saved conversations:");
	for (const session of recentSessions) {
		const lastUser = session.messages.find((message) => message.role === "user");
		const lastAssistant = session.messages.find((message) => message.role === "assistant");
		const lines = [`- ${session.title} (${session.updatedAt.toISOString()})`];

		if (lastUser) {
			lines.push(`  Last user message: ${trimSnippet(lastUser.content, 140)}`);
		}
	}
}
```

Plain-English explanation:
This loop goes through saved sessions one by one and builds a summary instead of making me write separate code for every session.

### Functions Example

From [lib/googleCalendar.ts](lib/googleCalendar.ts):

```ts
function requireEnv(name: string) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not configured`);
	}
	return value;
}

export function createOAuthClient(origin?: string) {
	const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(origin);
	return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
```

Plain-English explanation:
These functions each have one job, which keeps the code organized and reusable.

### Prisma Schema Example

From [prisma/schema.prisma](prisma/schema.prisma):

```prisma
model ConversationSession {
	id             String                @id @default(cuid())
	source         String                @default("loco")
	title          String
	createdAt      DateTime              @default(now())
	updatedAt      DateTime              @updatedAt
	messages       ConversationMessage[]
	calendarEvents CalendarEventMemory[]

	@@index([source, updatedAt])
}

model ConversationMessage {
	id        String              @id @default(cuid())
	sessionId String
	role      String
	content   String              @db.Text
	position  Int
	createdAt DateTime            @default(now())
	session   ConversationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

Plain-English explanation:
This schema defines how chat sessions and messages are stored and connected in the database.

### Prisma Schema Example For Ratings

From [prisma/schema.prisma](prisma/schema.prisma):

```prisma
model WorkforceCompetency {
	id           Int                    @id @default(autoincrement())
	code         String                 @unique
	title        String
	itemType     String                 @default("skill")
	question     String?                @db.Text
	description  String?                @db.Text
	sortOrder    Int                    @default(0)
	areaId       Int?
	parentId     Int?
	area         WorkforceArea?         @relation(fields: [areaId], references: [id], onDelete: SetNull)
	parent       WorkforceCompetency?   @relation("WorkforceCompetencyTree", fields: [parentId], references: [id], onDelete: SetNull)
	children     WorkforceCompetency[]  @relation("WorkforceCompetencyTree")
}
```

Plain-English explanation:
This schema helps me store rubric categories, skill questions, and parent-child relationships for ratings.

### Prisma Queries Example

From [lib/chatMemory.ts](lib/chatMemory.ts):

```ts
if (input.messages.length > 0) {
	await transaction.conversationMessage.createMany({
		data: input.messages.map((message, index) => ({
			sessionId: session.id,
			role: message.role,
			content: message.content,
			position: index,
		})),
	});
}
```

Plain-English explanation:
This Prisma query saves multiple chat messages at once, which is faster and cleaner than saving them one by one.

### Another Prisma Query Example

From [lib/chatMemory.ts](lib/chatMemory.ts):

```ts
return prisma.conversationSession.findMany({
	where: { source: "loco" },
	include: {
		messages: {
			orderBy: { position: "asc" },
		},
	},
	orderBy: { updatedAt: "desc" },
});
```

Plain-English explanation:
This query loads saved sessions from the database and also pulls in the related messages in the correct order.

## 13. Fast Demo Script

If I need to explain the code while showing it, I can say:

"Here is an example of variables storing app settings. Here is a conditional making a decision based on data. Here is a loop repeating work without duplicated code. Here is a function keeping logic reusable. Here is my Prisma schema defining the database structure. And here is a Prisma query that saves or loads real app data. Together, these show how I am using and organizing core coding concepts in my project."
