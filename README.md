# School ERP - Multi-Tenant Platform

Enterprise School Management System with Multi-Tier and Multi-Tenant Architecture.

---

## Sandbox / Local Development Database Setup

To ensure complete isolation from the production database on Render, follow these steps to recreate and connect to the local sandbox database:

### 1. Environment Configuration

Define your local database URLs in `.env`:

```env
# Primary / Production Database URL (Keep separate - DO NOT overwrite with sandbox in production)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_erp_sandbox?schema=public"

# Explicit Sandbox Database URLs
DATABASE_URL_SANDBOX="postgresql://postgres:postgres@localhost:5432/school_erp_sandbox?schema=public"
SANDBOX_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_erp_sandbox?schema=public"
```

### 2. Push Schema to Sandbox Database

Run Prisma to automatically create the `school_erp_sandbox` database and synchronize all models, enums, and tables:

```bash
npx prisma db push --accept-data-loss
```

### 3. Seed Sandbox Data

Populate the sandbox database with mock schools (Demo School, Greenwood Academy, Summit High, Riverside University), platform admins, staff, students, and courses:

```bash
npx prisma db seed
```

### 4. Verify Connection & Data

- **Option A - Query verification:**
  ```bash
  node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const count = await prisma.school.count(); console.log('Active schools in sandbox:', count); await prisma.\$disconnect(); })();"
  ```

- **Option B - Prisma Studio:**
  ```bash
  npx prisma studio
  ```
  Open `http://localhost:5555` to view and inspect all populated tables in your browser.

---

## Production Isolation Rules

- **Never** run `prisma migrate reset` or `db push` against production database URLs.
- Always verify your active `DATABASE_URL` before running migration commands.
- Production and Sandbox URLs must remain strictly segregated.
