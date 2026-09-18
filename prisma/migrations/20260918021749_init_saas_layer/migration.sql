-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('BASIC', 'EXCELLENCE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "contactPhone" TEXT,
    "subscriptionPlan" "SubscriptionPlan" NOT NULL DEFAULT 'BASIC',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "subscriptionStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionExpiresAt" TIMESTAMP(3),
    "trialStartDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "trialEndDate" TIMESTAMP(3),
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "isPublicPortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "welcomeGreeting" TEXT DEFAULT 'Welcome to our institution!',
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "databaseUrl" TEXT,
    "isMultiDbEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tierDatabasesConfig" JSONB,
    "nurseryDbUrl" TEXT,
    "primaryDbUrl" TEXT,
    "secondaryDbUrl" TEXT,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "admissionNumber" TEXT,
    "currentClass" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "stateOfOrigin" TEXT,
    "parentName" TEXT,
    "parentOccupation" TEXT,
    "parentEmail" TEXT,
    "parentPhone" TEXT,
    "parentWhatsApp" TEXT,
    "dynamicFields" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "prospectAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "applicantAt" TIMESTAMP(3),
    "screenedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "expelledAt" TIMESTAMP(3),
    "alumniAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTier" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER,
    "databaseUrl" TEXT,
    "databaseName" TEXT,
    "tierDatabaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantTierDatabase" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databaseUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isProvisioned" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantTierDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "departmentId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" TEXT NOT NULL,
    "baseSalary" DOUBLE PRECISION,
    "bankAccountNumber" TEXT,
    "bankName" TEXT,
    "accountName" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONBOARDING',
    "onboardingAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "activeAt" TIMESTAMP(3),
    "leaveAt" TIMESTAMP(3),
    "offboardedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payDate" TIMESTAMP(3) NOT NULL,
    "receiptCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "tierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingType" TEXT NOT NULL DEFAULT 'FLAT',
    "defaultAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeTemplateId" TEXT,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timetable" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "ca1" DOUBLE PRECISION NOT NULL,
    "ca2" DOUBLE PRECISION NOT NULL,
    "exam" DOUBLE PRECISION NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT,
    "test1" DOUBLE PRECISION DEFAULT 0,
    "test2" DOUBLE PRECISION DEFAULT 0,
    "midTerm" DOUBLE PRECISION DEFAULT 0,
    "finalExam" DOUBLE PRECISION DEFAULT 0,
    "totalScore" DOUBLE PRECISION DEFAULT 0,
    "gradeLetter" TEXT,
    "isPassed" BOOLEAN DEFAULT true,
    "assessmentType" TEXT DEFAULT 'NUMERICAL',
    "narrativeRating" TEXT,
    "skillsEvaluation" JSONB,
    "narrativeFeedback" TEXT,
    "teacherRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCard" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "tier" TEXT,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gradeLetter" TEXT,
    "gpa" DOUBLE PRECISION,
    "classPosition" INTEGER,
    "totalStudentsInClass" INTEGER,
    "totalSubjects" INTEGER NOT NULL DEFAULT 0,
    "passedSubjects" INTEGER NOT NULL DEFAULT 0,
    "failedSubjects" INTEGER NOT NULL DEFAULT 0,
    "narrativeSummary" TEXT,
    "developmentIndicators" JSONB,
    "teacherRemarks" TEXT,
    "principalRemarks" TEXT,
    "nextTermBegins" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "academicRecordSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "semester" TEXT NOT NULL DEFAULT 'Fall 2026',
    "date" TIMESTAMP(3) NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "ca1Score" DOUBLE PRECISION DEFAULT 0,
    "ca2Score" DOUBLE PRECISION DEFAULT 0,
    "examScore" DOUBLE PRECISION DEFAULT 0,
    "letterGrade" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL DEFAULT 'STUDENT',
    "messageType" TEXT NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionLead" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "studentEmail" TEXT,
    "studentPhone" TEXT,
    "parentName" TEXT,
    "parentContact" TEXT NOT NULL,
    "parentPhone" TEXT,
    "parentEmail" TEXT,
    "targetGrade" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INQUIRY',
    "assignedCounselor" TEXT,
    "logs" JSONB DEFAULT '[]',
    "offerToken" TEXT,
    "offerExpiresAt" TIMESTAMP(3),
    "uploadToken" TEXT,
    "uploadExpiresAt" TIMESTAMP(3),
    "passportPhotoUrl" TEXT,
    "academicResultsUrl" TEXT,
    "birthCertificateUrl" TEXT,
    "medicalRecordsUrl" TEXT,
    "documents" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionNote" (
    "id" TEXT NOT NULL,
    "studentLeadId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "tenantId" TEXT,
    "schoolDomain" TEXT,
    "role" TEXT NOT NULL,
    "staffRole" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceNgn" INTEGER NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "maxStudents" INTEGER NOT NULL,
    "maxStaff" INTEGER NOT NULL,
    "maxStorageGb" INTEGER NOT NULL DEFAULT 10,
    "modules" JSONB NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "adminEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "institutionTypes" JSONB NOT NULL,
    "planId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "kycStatus" TEXT NOT NULL DEFAULT 'pending',
    "kycDocs" JSONB,
    "paystackSubaccountCode" TEXT,
    "paystackSplitCode" TEXT,
    "isImpersonationAllowed" BOOLEAN NOT NULL DEFAULT true,
    "suspendedReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "amountDue" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paystackSubscriptionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformWallet" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tenantId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_subdomain_key" ON "School"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- CreateIndex
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Student_schoolId_tierId_status_createdAt_idx" ON "Student"("schoolId", "tierId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Student_schoolId_currentClass_status_idx" ON "Student"("schoolId", "currentClass", "status");

-- CreateIndex
CREATE INDEX "Student_schoolId_createdAt_idx" ON "Student"("schoolId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Student_schoolId_lastName_firstName_idx" ON "Student"("schoolId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Student_tierId_idx" ON "Student"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_schoolId_admissionNumber_key" ON "Student"("schoolId", "admissionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTier_schoolId_name_key" ON "AcademicTier"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TenantTierDatabase_schoolId_tierName_key" ON "TenantTierDatabase"("schoolId", "tierName");

-- CreateIndex
CREATE INDEX "Staff_schoolId_status_idx" ON "Staff"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Staff_schoolId_role_status_idx" ON "Staff"("schoolId", "role", "status");

-- CreateIndex
CREATE INDEX "Staff_schoolId_departmentId_idx" ON "Staff"("schoolId", "departmentId");

-- CreateIndex
CREATE INDEX "Staff_schoolId_createdAt_idx" ON "Staff"("schoolId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_schoolId_email_key" ON "Staff"("schoolId", "email");

-- CreateIndex
CREATE INDEX "Department_schoolId_idx" ON "Department"("schoolId");

-- CreateIndex
CREATE INDEX "Department_schoolId_tierId_idx" ON "Department"("schoolId", "tierId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_schoolId_name_key" ON "Department"("schoolId", "name");

-- CreateIndex
CREATE INDEX "PayrollRecord_schoolId_staffId_idx" ON "PayrollRecord"("schoolId", "staffId");

-- CreateIndex
CREATE INDEX "PayrollRecord_schoolId_status_payDate_idx" ON "PayrollRecord"("schoolId", "status", "payDate" DESC);

-- CreateIndex
CREATE INDEX "Classroom_schoolId_idx" ON "Classroom"("schoolId");

-- CreateIndex
CREATE INDEX "Classroom_schoolId_tierId_idx" ON "Classroom"("schoolId", "tierId");

-- CreateIndex
CREATE INDEX "Course_schoolId_idx" ON "Course"("schoolId");

-- CreateIndex
CREATE INDEX "Course_schoolId_tierId_idx" ON "Course"("schoolId", "tierId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_schoolId_code_key" ON "Course"("schoolId", "code");

-- CreateIndex
CREATE INDEX "FeeTemplate_schoolId_idx" ON "FeeTemplate"("schoolId");

-- CreateIndex
CREATE INDEX "FeeTemplate_schoolId_createdAt_idx" ON "FeeTemplate"("schoolId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_schoolId_studentId_idx" ON "Invoice"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_status_dueDate_idx" ON "Invoice"("schoolId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_createdAt_idx" ON "Invoice"("schoolId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Invoice_feeTemplateId_idx" ON "Invoice"("feeTemplateId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_invoiceId_idx" ON "Payment"("schoolId", "invoiceId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_paymentDate_idx" ON "Payment"("schoolId", "paymentDate" DESC);

-- CreateIndex
CREATE INDEX "Payment_schoolId_studentId_paymentDate_idx" ON "Payment"("schoolId", "studentId", "paymentDate" DESC);

-- CreateIndex
CREATE INDEX "Transaction_schoolId_type_idx" ON "Transaction"("schoolId", "type");

-- CreateIndex
CREATE INDEX "Transaction_schoolId_category_idx" ON "Transaction"("schoolId", "category");

-- CreateIndex
CREATE INDEX "Transaction_schoolId_type_category_createdAt_idx" ON "Transaction"("schoolId", "type", "category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Transaction_schoolId_createdAt_idx" ON "Transaction"("schoolId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Timetable_schoolId_dayOfWeek_idx" ON "Timetable"("schoolId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Timetable_schoolId_dayOfWeek_startTime_idx" ON "Timetable"("schoolId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "Timetable_schoolId_staffId_dayOfWeek_idx" ON "Timetable"("schoolId", "staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Timetable_schoolId_classroomId_dayOfWeek_idx" ON "Timetable"("schoolId", "classroomId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "StudentAttendance_schoolId_date_idx" ON "StudentAttendance"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StudentAttendance_schoolId_date_status_idx" ON "StudentAttendance"("schoolId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendance_schoolId_studentId_date_key" ON "StudentAttendance"("schoolId", "studentId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_schoolId_date_idx" ON "StaffAttendance"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_schoolId_date_status_idx" ON "StaffAttendance"("schoolId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_schoolId_staffId_date_key" ON "StaffAttendance"("schoolId", "staffId", "date");

-- CreateIndex
CREATE INDEX "GradeRecord_schoolId_studentId_idx" ON "GradeRecord"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "GradeRecord_schoolId_term_className_subject_idx" ON "GradeRecord"("schoolId", "term", "className", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRecord_schoolId_studentId_term_className_subject_key" ON "GradeRecord"("schoolId", "studentId", "term", "className", "subject");

-- CreateIndex
CREATE INDEX "AcademicRecord_schoolId_studentId_idx" ON "AcademicRecord"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "AcademicRecord_schoolId_term_academicYear_idx" ON "AcademicRecord"("schoolId", "term", "academicYear");

-- CreateIndex
CREATE INDEX "AcademicRecord_schoolId_className_term_academicYear_idx" ON "AcademicRecord"("schoolId", "className", "term", "academicYear");

-- CreateIndex
CREATE INDEX "AcademicRecord_schoolId_subject_term_academicYear_idx" ON "AcademicRecord"("schoolId", "subject", "term", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicRecord_schoolId_studentId_subject_term_academicYear_key" ON "AcademicRecord"("schoolId", "studentId", "subject", "term", "academicYear");

-- CreateIndex
CREATE INDEX "ReportCard_schoolId_studentId_idx" ON "ReportCard"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "ReportCard_schoolId_className_term_academicYear_idx" ON "ReportCard"("schoolId", "className", "term", "academicYear");

-- CreateIndex
CREATE INDEX "ReportCard_schoolId_term_academicYear_classPosition_idx" ON "ReportCard"("schoolId", "term", "academicYear", "classPosition");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_schoolId_studentId_term_academicYear_key" ON "ReportCard"("schoolId", "studentId", "term", "academicYear");

-- CreateIndex
CREATE INDEX "Exam_schoolId_courseId_idx" ON "Exam"("schoolId", "courseId");

-- CreateIndex
CREATE INDEX "Exam_schoolId_semester_date_idx" ON "Exam"("schoolId", "semester", "date" DESC);

-- CreateIndex
CREATE INDEX "ExamResult_schoolId_studentId_idx" ON "ExamResult"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "ExamResult_schoolId_examId_score_idx" ON "ExamResult"("schoolId", "examId", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_schoolId_examId_studentId_key" ON "ExamResult"("schoolId", "examId", "studentId");

-- CreateIndex
CREATE INDEX "Notice_schoolId_targetAudience_idx" ON "Notice"("schoolId", "targetAudience");

-- CreateIndex
CREATE INDEX "Notice_schoolId_targetAudience_priority_createdAt_idx" ON "Notice"("schoolId", "targetAudience", "priority", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MessageLog_schoolId_recipientEmail_idx" ON "MessageLog"("schoolId", "recipientEmail");

-- CreateIndex
CREATE INDEX "MessageLog_schoolId_sentAt_idx" ON "MessageLog"("schoolId", "sentAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionLead_offerToken_key" ON "AdmissionLead"("offerToken");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionLead_uploadToken_key" ON "AdmissionLead"("uploadToken");

-- CreateIndex
CREATE INDEX "AdmissionLead_schoolId_status_idx" ON "AdmissionLead"("schoolId", "status");

-- CreateIndex
CREATE INDEX "AdmissionLead_schoolId_tierId_status_createdAt_idx" ON "AdmissionLead"("schoolId", "tierId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdmissionLead_tierId_idx" ON "AdmissionLead"("tierId");

-- CreateIndex
CREATE INDEX "AdmissionNote_studentLeadId_idx" ON "AdmissionNote"("studentLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_sessionToken_idx" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_tenantId_idx" ON "Session"("tenantId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_tenantId_key" ON "Wallet"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformTransaction_reference_key" ON "PlatformTransaction"("reference");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "AcademicTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTier" ADD CONSTRAINT "AcademicTier_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicTier" ADD CONSTRAINT "AcademicTier_tierDatabaseId_fkey" FOREIGN KEY ("tierDatabaseId") REFERENCES "TenantTierDatabase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantTierDatabase" ADD CONSTRAINT "TenantTierDatabase_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "AcademicTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "AcademicTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "AcademicTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeTemplate" ADD CONSTRAINT "FeeTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_feeTemplateId_fkey" FOREIGN KEY ("feeTemplateId") REFERENCES "FeeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timetable" ADD CONSTRAINT "Timetable_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRecord" ADD CONSTRAINT "GradeRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRecord" ADD CONSTRAINT "AcademicRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicRecord" ADD CONSTRAINT "AcademicRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionLead" ADD CONSTRAINT "AdmissionLead_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionLead" ADD CONSTRAINT "AdmissionLead_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "AcademicTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionNote" ADD CONSTRAINT "AdmissionNote_studentLeadId_fkey" FOREIGN KEY ("studentLeadId") REFERENCES "AdmissionLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
