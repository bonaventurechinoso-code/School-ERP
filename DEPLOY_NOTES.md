# Production Deployment & Database Synchronization Guide
## Target Host: `bonaveeict.com.ng`

### Background
The admissions module has been upgraded to the enterprise standard, introducing `AdmissionCycle` (`admission_cycles`) and `AdmissionAuditTrail` (`admission_audit_trails`). The application has defensive fallbacks (`.catch(() => [])`), but until the database tables are physically synced on production, cycles and audit history fall back to defaults.

---

### Step 1: SSH into Production Server
```bash
ssh <user>@bonaveeict.com.ng
# Or via your configured IP/SSH key
```

---

### Step 2: Navigate to the Application Directory
```bash
cd /var/www/school-erp # Or your production deployment directory
git pull origin main
```

---

### Step 3: Synchronize Database Schema (Zero Data Loss)
Run Prisma schema sync. Because production has existing tables without full initial migration baselines, use `prisma db push` (or `prisma migrate deploy` if your production uses full Prisma migrate baselines):

```bash
# Try standard migration first:
npx prisma migrate deploy

# If Prisma reports P3005 (database schema is not empty), run safe db push:
npx prisma db push --accept-data-loss=false
```

---

### Step 4: Regenerate Prisma Client
```bash
npx prisma generate
```

---

### Step 5: Verify Tables in Production PostgreSQL
Connect to the production database via `psql` or run an inline query:

```bash
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('admission_cycles', 'admission_audit_trails', 'AdmissionCycle', 'AdmissionAuditTrail');"
```

Verify that `admission_cycles` and `admission_audit_trails` are returned.

Quick sanity check:
```bash
psql $DATABASE_URL -c "SELECT count(*) FROM admission_cycles;"
psql $DATABASE_URL -c "SELECT count(*) FROM admission_audit_trails;"
```

---

### Step 6: Rebuild and Restart Application
```bash
# Production Next.js build
npm run build

# Restart PM2 process
pm2 restart all # Or: pm2 restart school-erp
pm2 logs --lines 50
```

---

### Verification Checklist
- [ ] Production `/egede/dashboard` loads with all metric cards hydrated.
- [ ] Production `/egede/admissions` loads the Enterprise Workspace (funnel cards, Kanban board, applications table, and embedded fee reconciliations).
- [ ] No server digest errors in PM2 logs.

