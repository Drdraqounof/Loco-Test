-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "email" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiryDate" BIGINT,
    "scope" TEXT,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingCalendarDraft" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'loco',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startIso" TIMESTAMP(3) NOT NULL,
    "endIso" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "rawRequest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingCalendarDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'loco',
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventMemory" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'loco',
    "googleEventId" TEXT,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startIso" TIMESTAMP(3) NOT NULL,
    "endIso" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "htmlLink" TEXT,
    "rawRequest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMemory" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'loco',
    "kind" TEXT NOT NULL DEFAULT 'fact',
    "content" TEXT NOT NULL,
    "normalizedContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_provider_key" ON "GoogleCalendarConnection"("provider");

-- CreateIndex
CREATE INDEX "PendingCalendarDraft_createdAt_idx" ON "PendingCalendarDraft"("createdAt");

-- CreateIndex
CREATE INDEX "ConversationSession_source_updatedAt_idx" ON "ConversationSession"("source", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_sessionId_createdAt_idx" ON "ConversationMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_sessionId_position_key" ON "ConversationMessage"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventMemory_googleEventId_key" ON "CalendarEventMemory"("googleEventId");

-- CreateIndex
CREATE INDEX "CalendarEventMemory_source_startIso_idx" ON "CalendarEventMemory"("source", "startIso");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantMemory_normalizedContent_key" ON "AssistantMemory"("normalizedContent");

-- CreateIndex
CREATE INDEX "AssistantMemory_source_updatedAt_idx" ON "AssistantMemory"("source", "updatedAt");

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventMemory" ADD CONSTRAINT "CalendarEventMemory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
