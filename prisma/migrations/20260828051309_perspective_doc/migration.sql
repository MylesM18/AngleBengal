-- CreateTable
CREATE TABLE "PerspectiveDoc" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerspectiveDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerspectiveDoc_topicId_key" ON "PerspectiveDoc"("topicId");

-- AddForeignKey
ALTER TABLE "PerspectiveDoc" ADD CONSTRAINT "PerspectiveDoc_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
