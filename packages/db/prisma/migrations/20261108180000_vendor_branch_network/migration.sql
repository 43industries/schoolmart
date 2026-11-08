-- Vendor self-registration writes branch_network; column was in schema but never migrated.
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "branch_network" TEXT;
