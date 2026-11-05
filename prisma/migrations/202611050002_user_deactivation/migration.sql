ALTER TABLE "user" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
                   ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "user_lifecycle_event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "replacementId" TEXT,
  "replacementName" TEXT,
  "transfers" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "user_lifecycle_event_userId_createdAt_idx" ON "user_lifecycle_event"("userId", "createdAt");
