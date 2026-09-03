-- CreateTable
CREATE TABLE "FeynmanSession" (
    "id" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "exchangesJson" TEXT NOT NULL,
    "reportJson" TEXT NOT NULL,
    "accuracy" INTEGER NOT NULL,
    "simplicity" INTEGER NOT NULL,
    "coverage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeynmanSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeynmanSession_docId_createdAt_idx" ON "FeynmanSession"("docId", "createdAt");

-- AddForeignKey
ALTER TABLE "FeynmanSession" ADD CONSTRAINT "FeynmanSession_docId_fkey" FOREIGN KEY ("docId") REFERENCES "MentalModelDoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
