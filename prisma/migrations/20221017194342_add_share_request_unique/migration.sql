/*
  Warnings:

  - A unique constraint covering the columns `[from_user_id,to_user_id]` on the table `ShareRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ShareRequest_from_user_id_to_user_id_key" ON "ShareRequest"("from_user_id", "to_user_id");
