# School ERP - Multi-Tenant Platform

Enterprise School Management System with Multi-Tier and Multi-Tenant Architecture.

---

## Environment Separation Architecture

The platform strictly isolates three runtime database environments:

| Environment | Purpose | Database Provider / URL | Data State | Reset Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Production** | Live real-world schools, actual student/staff records, finance & payments | Render Managed PostgreSQL (`DATABASE_URL`), secret, stored **only** in Render Dashboard environment variables | Real institutional data, empty initial state on onboarding, isolated by `schoolId` / `tenantId` | **Never** auto-reset. Protected from `prisma db push --accept-data-loss` |
| **Local Sandbox** | Developer workstation testing & local debugging only | `postgresql://USER:PASSWORD@localhost:5432/school_erp_sandbox?schema=public` (`DATABASE_URL` / `SANDBOX_DATABASE_URL`) | Mock test schools (Greenwood, Summit High, Riverside, etc.) | Safely modifiable with `npx prisma db push --accept-data-loss` and seed scripts |
| **Demo Playground** | Public visitor walkthrough (`/demo`), accessible via "Explore Demo Environment" | Dedicated separate database on Render (`DEMO_DATABASE_URL`), never Production, never localhost | Synthetic dummy pupils, staff, attendance, and sample CA score records | Periodic automated cron reset & clean re-seed (`executeDemoCleanup()`), no real school data |

---

## User Journeys & Onboarding Flows

### 1. Try Demo ("Explore Demo Environment")
- **Entry Point**: Landing page hero button `Explore Demo Environment` or footer link.
- **Signup Required?**: **No.** Completely friction-free, zero registration.
- **Session**: Generates a temporary guest session cookie (`role: "TENANT_ADMIN"`).
- **School Target**: Single fixed demo school instance (`subdomain: "demo"`).
- **Database**: Runs against `DEMO_DATABASE_URL`. **Never** touches Production DB or real tenant data.
- **Reset Logic**: Automatically purges visitor clutter and restores baseline mock records on schedule.

### 2. Start Free Trial ("Start Free Trial")
- **Entry Point**: Landing page hero button `Start Free Trial`.
- **Signup Required?**: **Yes.** Requires School Name, Administrator Name, Email, Phone, Institutional Tiers, and Password.
- **Provisioning**: Creates a **real, dedicated institution** in the Production database:
  - `status: "trial"`
  - `isTrial: true`
  - `trialStartDate: now`
  - `trialEndDate: now + 14 days`
  - `subscription: "14_DAY_TRIAL"` (₦0 charge)
- **Data State**: Clean, empty initial state (0 students, 0 staff, 0 transactions) ready for actual pupil enrollment.
- **Tenant Isolation**: Strictly isolated by `schoolId` and `tenantId` across all Prisma database operations.
- **Expiry & Lockout**: Once the 14-day trial period lapses, protected tenant workspace routes automatically lock access and redirect to `/trial-expired` with options to upgrade.

---

## Local Development & Sandbox Setup

Follow these steps to run the application on your local developer workstation:

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure your local PostgreSQL credentials:

```env
# Local Sandbox Database (Local developer workstation only)
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/school_erp_sandbox?schema=public"
SANDBOX_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/school_erp_sandbox?schema=public"

# Optional: Dedicated local demo database (if testing demo reset locally)
DEMO_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/school_erp_demo?schema=public"
```

### 2. Push Schema to Local Sandbox

Synchronize all Prisma models, enums, and tables with your local database:

```bash
npx prisma db push --accept-data-loss
```

### 3. Seed Sandbox Data

Populate the local sandbox with mock institutions, tiers, administrators, and sample classes:

```bash
npx prisma db seed
```

### 4. Verify Local Connection

- **Query verification:**
  ```bash
  node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); (async () => { const count = await prisma.school.count(); console.log('Active schools in sandbox:', count); await prisma.\$disconnect(); })();"
  ```

- **Prisma Studio:**
  ```bash
  npx prisma studio
  ```
  Open `http://localhost:5555` to inspect local sandbox tables in your browser.

---

## Production Security & Isolation Rules

- **Never** hardcode production credentials or database URLs in source code or documentation.
- **Never** run `prisma migrate reset` or `prisma db push --accept-data-loss` against production database URLs.
- Render Managed PostgreSQL URLs must reside exclusively in the secure Render Dashboard environment settings.
- The Demo Playground must always connect via `DEMO_DATABASE_URL` and must never share or mutate the Production database.
