-- AlterTable
ALTER TABLE "GoogleCalendarConnection" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "YouTubeConnection" ADD COLUMN IF NOT EXISTS "userId" INTEGER;

-- Ensure default app user
INSERT INTO "User" ("email", "name", "createdAt", "updatedAt")
SELECT 'app@local', 'Loco App', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'app@local');

-- Backfill existing connections onto the default app user
UPDATE "GoogleCalendarConnection" AS g
SET "userId" = u.id
FROM "User" AS u
WHERE u."email" = 'app@local' AND g."userId" IS NULL;

UPDATE "YouTubeConnection" AS y
SET "userId" = u.id
FROM "User" AS u
WHERE u."email" = 'app@local' AND y."userId" IS NULL;

-- Drop legacy singleton uniqueness
ALTER TABLE "GoogleCalendarConnection" DROP CONSTRAINT IF EXISTS "GoogleCalendarConnection_provider_key";
ALTER TABLE "YouTubeConnection" DROP CONSTRAINT IF EXISTS "YouTubeConnection_provider_key";

-- Require userId after backfill
ALTER TABLE "GoogleCalendarConnection" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "YouTubeConnection" ALTER COLUMN "userId" SET NOT NULL;

-- Add foreign keys and new uniqueness
DO $$ BEGIN
  ALTER TABLE "GoogleCalendarConnection"
    ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "YouTubeConnection"
    ADD CONSTRAINT "YouTubeConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarConnection_userId_provider_key"
  ON "GoogleCalendarConnection"("userId", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "YouTubeConnection_userId_provider_key"
  ON "YouTubeConnection"("userId", "provider");
CREATE INDEX IF NOT EXISTS "GoogleCalendarConnection_provider_idx" ON "GoogleCalendarConnection"("provider");
CREATE INDEX IF NOT EXISTS "YouTubeConnection_provider_idx" ON "YouTubeConnection"("provider");
