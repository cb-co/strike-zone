-- DropForeignKey
ALTER TABLE "cash_activities" DROP CONSTRAINT "cash_activities_account_id_fkey";

-- CreateIndex
CREATE INDEX "cash_activities_account_id_idx" ON "cash_activities"("account_id");

-- CreateIndex
CREATE INDEX "cash_activities_import_batch_id_idx" ON "cash_activities"("import_batch_id");

-- AddForeignKey
ALTER TABLE "cash_activities" ADD CONSTRAINT "cash_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
