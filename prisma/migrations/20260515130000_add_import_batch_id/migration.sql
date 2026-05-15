-- AlterTable
ALTER TABLE "trades" ADD COLUMN "import_batch_id" UUID;
ALTER TABLE "trades" ADD COLUMN "closed_by_batch_id" UUID;
