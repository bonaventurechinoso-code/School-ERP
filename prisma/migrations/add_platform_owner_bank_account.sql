CREATE TABLE IF NOT EXISTS "PlatformOwnerBankAccount" (
  "id" TEXT PRIMARY KEY,
  "bankName" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "bankCode" TEXT,
  "isPrimary" BOOLEAN DEFAULT true,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

ALTER TABLE "PlatformOwnerBankAccount" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN DEFAULT true;
ALTER TABLE "PlatformOwnerBankAccount" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "PlatformOwnerBankAccount" ADD COLUMN IF NOT EXISTS "bankCode" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlatformOwnerBankAccount_accountNumber_key'
  ) THEN
    ALTER TABLE "PlatformOwnerBankAccount" ADD CONSTRAINT "PlatformOwnerBankAccount_accountNumber_key" UNIQUE ("accountNumber");
  END IF;
END $$;

INSERT INTO "PlatformOwnerBankAccount" ("id","bankName","accountNumber","accountName","bankCode","isPrimary","isActive","createdAt","updatedAt")
VALUES ('global','Fidelity Bank','6560627850','BONAVEE ICT CONCEPTS','070',true,true,NOW(),NOW())
ON CONFLICT ("id") DO UPDATE SET
  "bankName" = EXCLUDED."bankName",
  "accountNumber" = EXCLUDED."accountNumber",
  "accountName" = EXCLUDED."accountName",
  "bankCode" = EXCLUDED."bankCode",
  "isPrimary" = EXCLUDED."isPrimary",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();
