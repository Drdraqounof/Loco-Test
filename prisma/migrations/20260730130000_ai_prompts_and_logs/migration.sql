-- CreateTable
CREATE TABLE IF NOT EXISTS "Prompt" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AiInteractionLog" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptName" TEXT,
    "promptVersion" INTEGER,
    "schemaVersion" TEXT,
    "rulesVersion" TEXT,
    "temperature" DOUBLE PRECISION,
    "userInput" TEXT NOT NULL,
    "aiOutput" TEXT,
    "validationResult" TEXT,
    "routingProvider" TEXT,
    "executionTimeMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInteractionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_name_version_key" ON "Prompt"("name", "version");
CREATE INDEX IF NOT EXISTS "Prompt_name_isActive_version_idx" ON "Prompt"("name", "isActive", "version");
CREATE INDEX IF NOT EXISTS "AiInteractionLog_createdAt_idx" ON "AiInteractionLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AiInteractionLog_promptName_promptVersion_idx" ON "AiInteractionLog"("promptName", "promptVersion");
CREATE INDEX IF NOT EXISTS "AiInteractionLog_schemaVersion_idx" ON "AiInteractionLog"("schemaVersion");
CREATE INDEX IF NOT EXISTS "AiInteractionLog_success_createdAt_idx" ON "AiInteractionLog"("success", "createdAt");
