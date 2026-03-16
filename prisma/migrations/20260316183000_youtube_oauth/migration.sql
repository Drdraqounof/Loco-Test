-- CreateTable
CREATE TABLE "YouTubeConnection" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'youtube',
    "email" TEXT,
    "channelId" TEXT,
    "channelTitle" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiryDate" BIGINT,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YouTubeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeConnection_provider_key" ON "YouTubeConnection"("provider");