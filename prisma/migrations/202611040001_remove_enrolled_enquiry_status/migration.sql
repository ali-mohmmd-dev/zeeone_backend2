ALTER TYPE "EnquiryStatus" RENAME TO "EnquiryStatus_old";

CREATE TYPE "EnquiryStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'CONFIRMED',
  'NOT_INTERESTED',
  'FOLLOW_UP',
  'DROPPED',
  'INVALID'
);

ALTER TABLE "enquiry" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "enquiry"
  ALTER COLUMN "status" TYPE "EnquiryStatus"
  USING (
    CASE
      WHEN "status"::text = 'ENROLLED' THEN 'CONFIRMED'
      ELSE "status"::text
    END
  )::"EnquiryStatus";

ALTER TABLE "enquiry" ALTER COLUMN "status" SET DEFAULT 'NEW'::"EnquiryStatus";

DROP TYPE "EnquiryStatus_old";
