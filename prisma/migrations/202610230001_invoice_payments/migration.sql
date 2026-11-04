ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

ALTER TABLE "invoice"
  ADD COLUMN "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "shareToken" TEXT,
  ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderRules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "invoice" SET "balanceDue" = "totalAmount";
CREATE UNIQUE INDEX "invoice_shareToken_key" ON "invoice"("shareToken");

CREATE TABLE "payment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "customerId" TEXT,
  "paymentNumber" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amount" DOUBLE PRECISION NOT NULL,
  "paymentMode" TEXT NOT NULL,
  "depositTo" TEXT,
  "referenceNumber" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_paymentNumber_key" ON "payment"("paymentNumber");
CREATE INDEX "payment_invoiceId_paymentDate_idx" ON "payment"("invoiceId", "paymentDate");
CREATE INDEX "payment_customerId_idx" ON "payment"("customerId");
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment" ADD CONSTRAINT "payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment" ADD CONSTRAINT "payment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_number_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "autoGenerate" BOOLEAN NOT NULL DEFAULT true,
  "prefix" TEXT NOT NULL DEFAULT 'PAY-',
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "padding" INTEGER NOT NULL DEFAULT 6,
  "restartEachFiscalYear" BOOLEAN NOT NULL DEFAULT false,
  "lastResetFiscalYear" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_number_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_activity" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_activity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invoice_activity_invoiceId_createdAt_idx" ON "invoice_activity"("invoiceId", "createdAt");
ALTER TABLE "invoice_activity" ADD CONSTRAINT "invoice_activity_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_activity" ADD CONSTRAINT "invoice_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
