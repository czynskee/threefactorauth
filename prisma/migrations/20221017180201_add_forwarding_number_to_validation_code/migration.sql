/*
  Warnings:

  - Added the required column `forwarding_number` to the `ValidationCode` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ValidationCode" ADD COLUMN     "forwarding_number" TEXT NOT NULL;
