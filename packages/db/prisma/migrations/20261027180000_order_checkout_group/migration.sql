-- AlterTable
ALTER TABLE "orders" ADD COLUMN "checkout_group_id" TEXT;

-- CreateIndex
CREATE INDEX "orders_checkout_group_id_idx" ON "orders"("checkout_group_id");
