-- AlterTable "Course": Make code column optional for Creche, Nursery, Primary and Secondary subjects
ALTER TABLE "Course" ALTER COLUMN "code" DROP NOT NULL;
