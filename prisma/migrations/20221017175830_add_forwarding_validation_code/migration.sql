-- AlterTable
ALTER TABLE "User" ADD COLUMN     "forwarding_number" TEXT;

-- CreateTable
CREATE TABLE "ValidationCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "ValidationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ValidationCode_code_key" ON "ValidationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationCode_user_id_key" ON "ValidationCode"("user_id");

-- AddForeignKey
ALTER TABLE "ValidationCode" ADD CONSTRAINT "ValidationCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
