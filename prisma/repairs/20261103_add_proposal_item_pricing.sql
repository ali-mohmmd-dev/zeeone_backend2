-- Add proposal item pricing breakdown and per-item tax fields.
ALTER TABLE "proposal_item"
  ADD COLUMN IF NOT EXISTS "panelBrand" TEXT,
  ADD COLUMN IF NOT EXISTS "systemPrice" DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS "ksebFee" DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS "afterSubsidy" DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS "itemTaxRate" DECIMAL(9,6) NOT NULL DEFAULT 0;
