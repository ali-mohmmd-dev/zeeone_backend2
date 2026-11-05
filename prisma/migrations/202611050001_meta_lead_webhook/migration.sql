CREATE TABLE "meta_lead" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "enquiryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meta_lead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meta_lead_status_check" CHECK ("status" IN ('PENDING', 'RETRY', 'NEEDS_ATTENTION', 'IMPORTED'))
);
CREATE UNIQUE INDEX "meta_lead_enquiryId_key" ON "meta_lead"("enquiryId");
CREATE INDEX "meta_lead_status_nextAttemptAt_idx" ON "meta_lead"("status", "nextAttemptAt");
ALTER TABLE "meta_lead" ADD CONSTRAINT "meta_lead_enquiryId_fkey"
  FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
