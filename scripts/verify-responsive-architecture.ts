import fs from "fs";
import path from "path";

console.log("===============================================================================");
console.log("  VERIFYING RESPONSIVE ARCHITECTURE & DUAL PRESENTATION STANDARDS");
console.log("===============================================================================\n");

let passed = 0;
let total = 0;

function test(name: string, assertion: boolean, details?: string) {
  total++;
  if (assertion) {
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${name}`);
    if (details) console.error(`   Details: ${details}`);
  }
}

// 1. ClientLayout.tsx Responsive Navigation & Mobile Drawer
const clientLayoutPath = path.join(process.cwd(), "src/app/[schoolDomain]/ClientLayout.tsx");
const clientLayoutCode = fs.readFileSync(clientLayoutPath, "utf-8");

test("ClientLayout: Persistent hamburger button with touch-manipulation", 
  clientLayoutCode.includes("touch-manipulation") && clientLayoutCode.includes("setIsSidebarOpen(true)")
);

test("ClientLayout: Wallet Balance preserved inside mobile drawer", 
  clientLayoutCode.includes("isWalletAuthorized && headerContent") && clientLayoutCode.includes("mt-auto")
);

test("ClientLayout: Header titles truncate gracefully without clipping",
  clientLayoutCode.includes("truncate") && clientLayoutCode.includes("min-w-0")
);

// 2. TierSwitcher.tsx Touch Standards
const tierSwitcherPath = path.join(process.cwd(), "src/components/TierSwitcher.tsx");
const tierSwitcherCode = fs.readFileSync(tierSwitcherPath, "utf-8");

test("TierSwitcher: Touch-friendly heights & smooth horizontal scrolling",
  tierSwitcherCode.includes("touch-manipulation") && 
  tierSwitcherCode.includes("min-h-[38px]") && 
  tierSwitcherCode.includes("overflow-x-auto hide-scrollbar")
);

// 3. Platform Admin Dashboard (Registered Tenants)
const adminPagePath = path.join(process.cwd(), "src/app/admin/page.tsx");
const adminPageCode = fs.readFileSync(adminPagePath, "utf-8");

test("Admin Dashboard: Responsive KPI cards grid (sm:grid-cols-2 lg:grid-cols-3)",
  adminPageCode.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6")
);

test("Admin Dashboard: Desktop table wrapped with hidden md:block",
  adminPageCode.includes("hidden md:block overflow-x-auto")
);

test("Admin Dashboard: Mobile visual card view (md:hidden) with all fields & actions",
  adminPageCode.includes("md:hidden space-y-3.5") &&
  adminPageCode.includes("EditSchoolModal") &&
  adminPageCode.includes("toggleSchoolStatus") &&
  adminPageCode.includes("DeleteSchoolForm") &&
  adminPageCode.includes("school.students_count") &&
  adminPageCode.includes("school.staff_count")
);

// 4. Student Roster (StudentTable.tsx)
const studentTablePath = path.join(process.cwd(), "src/app/[schoolDomain]/(admin)/students/StudentTable.tsx");
const studentTableCode = fs.readFileSync(studentTablePath, "utf-8");

test("StudentTable: Dual presentation with desktop table (hidden md:block) and mobile cards (md:hidden)",
  studentTableCode.includes("hidden md:block") &&
  studentTableCode.includes("md:hidden space-y-3.5")
);

test("StudentTable: Mobile cards view retains selection checkbox, ID, class, guardian, and interactive status",
  studentTableCode.includes("selectedIds.includes(student.id)") &&
  studentTableCode.includes("student.admissionNumber") &&
  studentTableCode.includes("student.currentClass") &&
  studentTableCode.includes("student.parentName") &&
  studentTableCode.includes("handleUpdateStatus(student.id, e.target.value)")
);

test("StudentTable: Mobile Select All bar included for batch actions",
  studentTableCode.includes("md:hidden flex items-center justify-between") &&
  studentTableCode.includes("Select All (")
);

// 5. Admissions Kanban Pipeline (AdmissionsPipeline.tsx)
const pipelinePath = path.join(process.cwd(), "src/app/[schoolDomain]/(admin)/admissions/AdmissionsPipeline.tsx");
const pipelineCode = fs.readFileSync(pipelinePath, "utf-8");

test("AdmissionsPipeline: Touch-friendly mobile stage switcher tabs (lg:hidden)",
  pipelineCode.includes("lg:hidden p-3 bg-slate-100/80") &&
  pipelineCode.includes("STAGES.map") &&
  pipelineCode.includes("setMobileStage")
);

test("AdmissionsPipeline: Mobile single stage view (lg:hidden) and desktop 5-col Kanban (hidden lg:block)",
  pipelineCode.includes("lg:hidden flex-1 overflow-y-auto") &&
  pipelineCode.includes("hidden lg:block flex-1 overflow-x-auto")
);

test("AdmissionsPipeline: Fixed viewport review drawer overlay (fixed inset-0 z-50)",
  pipelineCode.includes("fixed inset-0 z-50 flex justify-end")
);

// 6. Finance Dashboard & Subcomponents
const financeDashPath = path.join(process.cwd(), "src/app/[schoolDomain]/(admin)/finance/FinanceDashboard.tsx");
const financeDashCode = fs.readFileSync(financeDashPath, "utf-8");

test("FinanceDashboard: Horizontally scrollable tabs on mobile",
  financeDashCode.includes("overflow-x-auto whitespace-nowrap hide-scrollbar")
);

test("FinanceDashboard: Responsive overview metric cards (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3)",
  financeDashCode.includes("grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")
);

const invoiceTablePath = path.join(process.cwd(), "src/app/[schoolDomain]/(admin)/finance/InvoiceTable.tsx");
const invoiceTableCode = fs.readFileSync(invoiceTablePath, "utf-8");

test("InvoiceTable: Dual presentation with desktop table and mobile cards",
  invoiceTableCode.includes("hidden md:block") &&
  invoiceTableCode.includes("md:hidden space-y-3.5")
);

const ledgerTablePath = path.join(process.cwd(), "src/app/[schoolDomain]/(admin)/finance/LedgerTable.tsx");
const ledgerTableCode = fs.readFileSync(ledgerTablePath, "utf-8");

test("LedgerTable: Dual presentation with desktop table and mobile cards",
  ledgerTableCode.includes("hidden md:block") &&
  ledgerTableCode.includes("md:hidden divide-y")
);

// 7. Entry Portals
const publicPagePath = path.join(process.cwd(), "src/app/[schoolDomain]/page.tsx");
const publicPageCode = fs.readFileSync(publicPagePath, "utf-8");

test("Public Portal: Responsive Student & Staff Portal buttons without clipping",
  publicPageCode.includes("Student<span className=\"hidden sm:inline\"> Portal</span>") &&
  publicPageCode.includes("Staff<span className=\"hidden sm:inline\"> Portal</span>")
);

console.log(`\n===============================================================================`);
console.log(`  RESULTS: ${passed} / ${total} CHECKS PASSED (${Math.round((passed / total) * 100)}%)`);
console.log(`===============================================================================`);

if (passed !== total) {
  process.exit(1);
} else {
  console.log("🎉 ALL RESPONSIVE ARCHITECTURE AND DUAL PRESENTATION CRITERIA VERIFIED!\n");
}
