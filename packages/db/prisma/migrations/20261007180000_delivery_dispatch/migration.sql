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
