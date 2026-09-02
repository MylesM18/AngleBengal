-- CreateTable
CREATE TABLE "PerspectiveReadProgress" (
    "topicId" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerspectiveReadProgress_pkey" PRIMARY KEY ("topicId","sectionIndex")
);

-- AddForeignKey
ALTER TABLE "PerspectiveReadProgress" ADD CONSTRAINT "PerspectiveReadProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
