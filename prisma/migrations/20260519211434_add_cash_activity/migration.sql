-- CreateEnum
CREATE TYPE "CashActivityType" AS ENUM ('MARGIN_INTEREST', 'INTEREST', 'DIVIDEND', 'TAX', 'DEPOSIT', 'WITHDRAWAL', 'OTHER');

-- CreateTable
CREATE TABLE "cash_activities" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "type" "CashActivityType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "import_batch_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_activities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cash_activities" ADD CONSTRAINT "cash_activities_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
