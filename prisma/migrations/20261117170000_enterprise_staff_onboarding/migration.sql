-- AlterTable "Staff": Add Enterprise Demographic, Accreditation, Payroll & KYC Columns
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "residentialAddress" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "lga" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nin" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "passportUrl" TEXT;

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "dateOfEmployment" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "employmentType" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "departmentName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "reportingToId" TEXT;

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "highestQualification" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "fieldOfStudy" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "institutionAttended" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "yearGraduated" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "trcnNumber" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "trcnExpiry" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "trcnStatus" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "professionalBody" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "professionalMembershipNo" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "professionalExpiry" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "specialization" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "academicRank" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "cvUrl" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "certificates" TEXT;

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinPhone" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinRelationship" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nextOfKinAddress" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "emergencyName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "guarantorName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "guarantorPhone" TEXT;

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "baseSalary" DOUBLE PRECISION;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "payGrade" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "accountName" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "pensionRsa" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "pensionProvider" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "nhisNo" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "tin" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT 'BANK_TRANSFER';
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "permissions" TEXT;

-- Create Index for Staff Sequential ID
CREATE INDEX IF NOT EXISTS "Staff_schoolId_staffId_idx" ON "Staff"("schoolId", "staffId");

-- Self-referential Foreign Key for Staff Line Manager
DO $$ BEGIN
  ALTER TABLE "Staff" ADD CONSTRAINT "Staff_reportingToId_fkey" FOREIGN KEY ("reportingToId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

-- CreateTable "StaffAssignment"
CREATE TABLE IF NOT EXISTS "StaffAssignment" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "classroomId" TEXT,
  "courseId" TEXT,
  "assignmentType" TEXT NOT NULL,
  "assignedRole" TEXT,
  "session" TEXT,
  "faculty" TEXT,
  "department" TEXT,
  "programme" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

-- Indexes for "StaffAssignment"
CREATE INDEX IF NOT EXISTS "StaffAssignment_schoolId_idx" ON "StaffAssignment"("schoolId");
CREATE INDEX IF NOT EXISTS "StaffAssignment_staffId_idx" ON "StaffAssignment"("staffId");
CREATE INDEX IF NOT EXISTS "StaffAssignment_classroomId_idx" ON "StaffAssignment"("classroomId");
CREATE INDEX IF NOT EXISTS "StaffAssignment_courseId_idx" ON "StaffAssignment"("courseId");
CREATE INDEX IF NOT EXISTS "StaffAssignment_assignmentType_idx" ON "StaffAssignment"("assignmentType");

-- Foreign Keys for "StaffAssignment"
DO $$ BEGIN
  ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;
