-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "emoji" TEXT,
ADD COLUMN     "favoritedAt" TIMESTAMP(3),
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false;

-- The six seeded subjects get their emblems (subjects spec Section 3).
UPDATE "Topic" SET "emoji" = '🧮' WHERE "parentId" IS NULL AND "name" = 'Algebra';
UPDATE "Topic" SET "emoji" = '📐' WHERE "parentId" IS NULL AND "name" = 'Geometry';
UPDATE "Topic" SET "emoji" = '🌊' WHERE "parentId" IS NULL AND "name" = 'Trigonometry';
UPDATE "Topic" SET "emoji" = '📈' WHERE "parentId" IS NULL AND "name" = 'Precalculus';
UPDATE "Topic" SET "emoji" = '🎢' WHERE "parentId" IS NULL AND "name" = 'Calculus';
UPDATE "Topic" SET "emoji" = '🎲' WHERE "parentId" IS NULL AND "name" = 'Statistics & Probability';
