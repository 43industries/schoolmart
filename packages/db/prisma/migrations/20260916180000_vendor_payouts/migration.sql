-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VendorPayoutStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable vendors: payout destination
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "payout_mpesa_phone" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "payout_bank_name" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "payout_account_name" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "payout_account_number" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "vendor_payouts" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "status" "VendorPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "order_ids" JSONB NOT NULL DEFAULT '[]',
    "provider_ref" TEXT,
    "notes" TEXT,
    "settled_at" TIMESTAMP(3),
    "settled_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payouts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "vendor_payouts_vendor_id_idx" ON "vendor_payouts"("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_payouts_status_idx" ON "vendor_payouts"("status");
CREATE INDEX IF NOT EXISTS "vendor_payouts_created_at_idx" ON "vendor_payouts"("created_at");

DO $$ BEGIN
  ALTER TABLE "vendor_payouts" ADD CONSTRAINT "vendor_payouts_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
