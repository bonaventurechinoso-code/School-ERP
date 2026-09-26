UPDATE "School" SET "slug" = LOWER(REPLACE("name", ' ', '-')) || '-' || SUBSTRING("id", 1, 5) WHERE "slug" IS NULL;

-- AlterTable
ALTER TABLE "School" ALTER COLUMN "slug" SET NOT NULL;
