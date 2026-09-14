-- AlterTable
ALTER TABLE "vendors" ADD COLUMN "owner_user_id" TEXT;
ALTER TABLE "vendors" ADD COLUMN "county" TEXT;
ALTER TABLE "vendors" ADD COLUMN "town" TEXT;
ALTER TABLE "vendors" ADD COLUMN "address_line" TEXT;
ALTER TABLE "vendors" ADD COLUMN "sell_categories" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "vendors" ADD COLUMN "terms_version" TEXT;
ALTER TABLE "vendors" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "vendors" ADD COLUMN "agreement_version" TEXT;
ALTER TABLE "vendors" ADD COLUMN "agreement_accepted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "vendors_owner_user_id_idx" ON "vendors"("owner_user_id");
CREATE INDEX "vendors_status_idx" ON "vendors"("status");

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
