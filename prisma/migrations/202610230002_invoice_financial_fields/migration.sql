-- Add only the customer schema used by invoice creation and listing. These
-- additions preserve all existing invoice and customer data.
CREATE TABLE IF NOT EXISTS "customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "state" TEXT,
  "gstin" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "invoice"
  ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "withholdingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "withholdingType" TEXT,
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "shareToken" TEXT,
  ADD COLUMN IF NOT EXISTS "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminderRules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "customer_name_idx" ON "customer"("name");
CREATE INDEX IF NOT EXISTS "customer_email_idx" ON "customer"("email");
CREATE INDEX IF NOT EXISTS "customer_phone_idx" ON "customer"("phone");
CREATE INDEX IF NOT EXISTS "customer_createdByUserId_idx" ON "customer"("createdByUserId");
CREATE INDEX IF NOT EXISTS "invoice_customerId_idx" ON "invoice"("customerId");

-- Invoice payments and activity are required by the invoice list and the
-- payment-number preview endpoints. Create these only when absent.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

CREATE TABLE IF NOT EXISTS "payment" (
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

CREATE TABLE IF NOT EXISTS "payment_number_settings" (
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

CREATE TABLE IF NOT EXISTS "invoice_activity" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_activity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_paymentNumber_key" ON "payment"("paymentNumber");
CREATE INDEX IF NOT EXISTS "payment_invoiceId_paymentDate_idx" ON "payment"("invoiceId", "paymentDate");
CREATE INDEX IF NOT EXISTS "payment_customerId_idx" ON "payment"("customerId");
CREATE INDEX IF NOT EXISTS "invoice_activity_invoiceId_createdAt_idx" ON "invoice_activity"("invoiceId", "createdAt");
