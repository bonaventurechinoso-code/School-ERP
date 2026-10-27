-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InstitutionTier" AS ENUM ('CRECHE', 'NURSERY', 'PRIMARY', 'SECONDARY', 'POLYTECHNIC', 'COLLEGE_OF_ED', 'UNIVERSITY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ApplicationDocumentType" AS ENUM ('BIRTH_CERT', 'JAMB_SLIP', 'WAEC_RESULT', 'NECO_RESULT', 'NABTEB_RESULT', 'TRANSCRIPT', 'NPC_CERT', 'IMMUNIZATION', 'PASSPORT_PHOTO', 'MEDICAL_REPORT', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AdmissionOfferType" AS ENUM ('PROVISIONAL', 'CONDITIONAL', 'DIRECT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "OfferPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'WAIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "admission_registers"
ADD COLUMN IF NOT EXISTS "tier" "InstitutionTier",
ADD COLUMN IF NOT EXISTS "cycle_id" TEXT,
ADD COLUMN IF NOT EXISTS "personal_data" JSONB,
ADD COLUMN IF NOT EXISTS "academic_history" JSONB,
ADD COLUMN IF NOT EXISTS "olevel_results" JSONB,
ADD COLUMN IF NOT EXISTS "jamb_details" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_registers_tenant_id_cycle_id_idx" ON "admission_registers"("tenant_id", "cycle_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "admission_cycles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "session" TEXT NOT NULL,
    "tier" "InstitutionTier" NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "application_fee" INTEGER NOT NULL DEFAULT 5000,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "application_form_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tier" "InstitutionTier" NOT NULL,
    "schema" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "application_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "type" "ApplicationDocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "verification_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_notes" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admission_screenings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "exam_score" DOUBLE PRECISION,
    "interview_score" DOUBLE PRECISION,
    "rubric" JSONB,
    "interviewer_id" TEXT,
    "recommendation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admission_offers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "offer_type" "AdmissionOfferType" NOT NULL DEFAULT 'PROVISIONAL',
    "class_or_dept" TEXT NOT NULL,
    "tuition_deposit" INTEGER NOT NULL DEFAULT 0,
    "acceptance_fee" INTEGER NOT NULL DEFAULT 0,
    "payment_status" "OfferPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "admission_audit_trails" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "register_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_stage" TEXT,
    "to_stage" TEXT,
    "ip" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_audit_trails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_cycles_tenant_id_idx" ON "admission_cycles"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_cycles_school_id_idx" ON "admission_cycles"("school_id");
CREATE INDEX IF NOT EXISTS "admission_cycles_tenant_id_school_id_tier_idx" ON "admission_cycles"("tenant_id", "school_id", "tier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "application_form_templates_tenant_id_idx" ON "application_form_templates"("tenant_id");
CREATE INDEX IF NOT EXISTS "application_form_templates_tenant_id_tier_idx" ON "application_form_templates"("tenant_id", "tier");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "application_documents_tenant_id_idx" ON "application_documents"("tenant_id");
CREATE INDEX IF NOT EXISTS "application_documents_register_id_idx" ON "application_documents"("register_id");
CREATE INDEX IF NOT EXISTS "application_documents_tenant_id_register_id_idx" ON "application_documents"("tenant_id", "register_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_screenings_tenant_id_idx" ON "admission_screenings"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_screenings_register_id_idx" ON "admission_screenings"("register_id");
CREATE INDEX IF NOT EXISTS "admission_screenings_tenant_id_register_id_idx" ON "admission_screenings"("tenant_id", "register_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_offers_tenant_id_idx" ON "admission_offers"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_offers_register_id_idx" ON "admission_offers"("register_id");
CREATE INDEX IF NOT EXISTS "admission_offers_tenant_id_register_id_idx" ON "admission_offers"("tenant_id", "register_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admission_audit_trails_tenant_id_idx" ON "admission_audit_trails"("tenant_id");
CREATE INDEX IF NOT EXISTS "admission_audit_trails_register_id_idx" ON "admission_audit_trails"("register_id");
CREATE INDEX IF NOT EXISTS "admission_audit_trails_tenant_id_register_id_idx" ON "admission_audit_trails"("tenant_id", "register_id");
