/*
  Warnings:

  - Added the required column `completed` to the `ShareRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShareRequest" ADD COLUMN     "completed" BOOLEAN NOT NULL;
