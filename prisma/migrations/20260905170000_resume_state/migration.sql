-- CreateTable (D-156): single-row app resume target.
CREATE TABLE "ResumeState" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contextJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeState_pkey" PRIMARY KEY ("id")
);

-- CreateTable (D-156): in-progress sketchpad work, one row per problem.
CREATE TABLE "ProblemWork" (
    "problemId" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemWork_pkey" PRIMARY KEY ("problemId")
);

-- AddForeignKey
ALTER TABLE "ProblemWork" ADD CONSTRAINT "ProblemWork_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
