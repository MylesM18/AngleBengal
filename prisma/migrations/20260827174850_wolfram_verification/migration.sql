-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "verifiedBy" TEXT,
ADD COLUMN     "wolframQuery" TEXT;

-- CreateTable
CREATE TABLE "ComputationCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultText" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComputationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ComputationCache_queryHash_key" ON "ComputationCache"("queryHash");
