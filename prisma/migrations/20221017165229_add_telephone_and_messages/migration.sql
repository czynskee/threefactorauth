-- CreateTable
CREATE TABLE "Telephone" (
    "id" SERIAL NOT NULL,
    "number" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "Telephone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "body" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "telephone_id" INTEGER NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Telephone_number_key" ON "Telephone"("number");

-- AddForeignKey
ALTER TABLE "Telephone" ADD CONSTRAINT "Telephone_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_telephone_id_fkey" FOREIGN KEY ("telephone_id") REFERENCES "Telephone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
