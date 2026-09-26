UPDATE "School" SET "slug" = LOWER(REPLACE("name", ' ', '-')) || '-' || SUBSTRING("id", 1, 5) WHERE "slug" IS NULL;
