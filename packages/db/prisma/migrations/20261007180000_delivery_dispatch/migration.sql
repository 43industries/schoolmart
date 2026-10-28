-- Delivery partners (missing from earlier migrations; required before batch FK)
DO $$ BEGIN
  CREATE TYPE "DeliveryPartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "delivery_partners" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "status" "DeliveryPartnerStatus" NOT NULL DEFAULT 'PENDING',
    "county" TEXT NOT NULL,
    "town" TEXT NOT NULL,
    "service_towns" TEXT NOT NULL,
    "vehicle_types" JSONB NOT NULL DEFAULT '[]',
    "terms_accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "delivery_partners_owner_user_id_idx" ON "delivery_partners"("owner_user_id");
CREATE INDEX IF NOT EXISTS "delivery_partners_status_idx" ON "delivery_partners"("status");

DO $$ BEGIN
  ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable delivery_batches: driver assignment + proof timestamps
ALTER TABLE "delivery_batches" ADD COLUMN IF NOT EXISTS "delivery_partner_id" TEXT;
ALTER TABLE "delivery_batches" ADD COLUMN IF NOT EXISTS "picked_up_at" TIMESTAMP(3);
ALTER TABLE "delivery_batches" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "delivery_batches_delivery_partner_id_idx" ON "delivery_batches"("delivery_partner_id");

DO $$ BEGIN
  ALTER TABLE "delivery_batches" ADD CONSTRAINT "delivery_batches_delivery_partner_id_fkey"
    FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Notification inbox ordering
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
