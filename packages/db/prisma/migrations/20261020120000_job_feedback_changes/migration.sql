-- Job feedback: child middle name, vendor business contact, delivery vehicle/logbook, school-delivery partners
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "middle_name" TEXT;
ALTER TABLE "parent_student_links" ADD COLUMN IF NOT EXISTS "claimed_middle_name" TEXT;

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "contact_person_name" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "contact_person_phone" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "website_url" TEXT;

ALTER TABLE "delivery_partners" ADD COLUMN IF NOT EXISTS "primary_vehicle_type" TEXT;
ALTER TABLE "delivery_partners" ADD COLUMN IF NOT EXISTS "vehicle_plate_number" TEXT;
ALTER TABLE "delivery_partners" ADD COLUMN IF NOT EXISTS "logbook_file_name" TEXT;
ALTER TABLE "delivery_partners" ADD COLUMN IF NOT EXISTS "logbook_mime_type" TEXT;
ALTER TABLE "delivery_partners" ADD COLUMN IF NOT EXISTS "logbook_stored_name" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_partners_vehicle_plate_number_key" ON "delivery_partners"("vehicle_plate_number");

CREATE TABLE IF NOT EXISTS "school_delivery_partners" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "delivery_partner_id" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_delivery_partners_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "school_delivery_partners_school_id_delivery_partner_id_key" ON "school_delivery_partners"("school_id", "delivery_partner_id");
CREATE INDEX IF NOT EXISTS "school_delivery_partners_school_id_approved_idx" ON "school_delivery_partners"("school_id", "approved");
CREATE INDEX IF NOT EXISTS "school_delivery_partners_delivery_partner_id_approved_idx" ON "school_delivery_partners"("delivery_partner_id", "approved");

DO $$ BEGIN
  ALTER TABLE "school_delivery_partners" ADD CONSTRAINT "school_delivery_partners_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "school_delivery_partners" ADD CONSTRAINT "school_delivery_partners_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
