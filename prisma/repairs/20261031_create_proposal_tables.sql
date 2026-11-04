-- Add the missing proposal tables only. Existing tables and rows are not altered.
-- Generated from the current backend Prisma schema.
BEGIN;
SET LOCAL search_path = public;

CREATE TABLE "proposal" (
    "id" TEXT NOT NULL,
    "proposalNo" TEXT NOT NULL,
    "title" TEXT,
    "enquiryId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientAddress" TEXT,
    "branch" TEXT,
    "branchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "subtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "createdById" TEXT,
    "createdByUser" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "proposal_item" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposal_proposalNo_key" ON "proposal"("proposalNo");

CREATE INDEX "proposal_proposalNo_idx" ON "proposal"("proposalNo");

CREATE INDEX "proposal_enquiryId_idx" ON "proposal"("enquiryId");

CREATE INDEX "proposal_branchId_idx" ON "proposal"("branchId");

CREATE INDEX "proposal_status_idx" ON "proposal"("status");

CREATE INDEX "proposal_createdAt_idx" ON "proposal"("createdAt");

CREATE INDEX "proposal_item_proposalId_idx" ON "proposal_item"("proposalId");

ALTER TABLE "proposal" ADD CONSTRAINT "proposal_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposal" ADD CONSTRAINT "proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposal_item" ADD CONSTRAINT "proposal_item_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
