-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'OTHER';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PaymentPurpose" AS ENUM ('FUND_WALLET', 'ORDER_CHECKOUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "student_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "actor_user_id" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "purpose" "PaymentPurpose" NOT NULL DEFAULT 'ORDER_CHECKOUT';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "phone_e164" TEXT;

-- Make parent_user_id nullable for student-initiated / system flows
ALTER TABLE "payments" ALTER COLUMN "parent_user_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "payments_student_id_idx" ON "payments"("student_id");
CREATE INDEX IF NOT EXISTS "payments_purpose_idx" ON "payments"("purpose");
