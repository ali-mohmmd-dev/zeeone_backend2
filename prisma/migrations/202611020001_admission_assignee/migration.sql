ALTER TABLE "admission" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;

CREATE INDEX IF NOT EXISTS "admission_assignedToUserId_idx" ON "admission"("assignedToUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admission_assignedToUserId_fkey'
  ) THEN
    ALTER TABLE "admission" ADD CONSTRAINT "admission_assignedToUserId_fkey"
      FOREIGN KEY ("assignedToUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
