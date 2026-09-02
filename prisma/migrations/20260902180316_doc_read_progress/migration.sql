-- CreateTable
CREATE TABLE "DocReadProgress" (
    "docId" TEXT NOT NULL,
    "modelNumber" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocReadProgress_pkey" PRIMARY KEY ("docId","modelNumber")
);

-- AddForeignKey
ALTER TABLE "DocReadProgress" ADD CONSTRAINT "DocReadProgress_docId_fkey" FOREIGN KEY ("docId") REFERENCES "MentalModelDoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
