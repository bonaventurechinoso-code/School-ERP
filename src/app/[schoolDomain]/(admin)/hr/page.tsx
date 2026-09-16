import { basePrisma } from "@/lib/tenant-prisma";
import { createDepartment, generatePayroll } from "./actions";
import PayrollDirectoryClient from "./PayrollDirectoryClient";
import { PlusCircle, Building } from "lucide-react";

export default async function HRPayrollPage({ 
  params: paramsPromise 
}: { 
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string }
}) {
  const params = await Promise.resolve(paramsPromise);
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      departments: true,
      staff: {
        include: { department: true, PayrollRecord: true },
        orderBy: { firstName: "asc" },
      }
    }
  });

  if (!school) {
    return (
      <div className="p-8 text-center text-slate-500">
        <h2 className="text-xl font-bold text-slate-800">Institution Not Found</h2>
        <p>No school registered under domain: {params.schoolDomain}</p>
      </div>
    );
  }

  async function handleCreateDepartmentAction(formData: FormData) {
    "use server";
    await createDepartment(params.schoolDomain, formData);
  }

  async function handleGeneratePayrollAction(formData: FormData) {
    "use server";
    await generatePayroll(params.schoolDomain, formData);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">HR & Payroll Management</h2>
        <p className="text-slate-500 mt-1">Manage staff compensation, electronic wallet payouts, banking destinations, and pay slips.</p>
      </div>

      {/* INTERACTIVE PAYROLL DIRECTORY WITH WALLET BANNER */}
      <PayrollDirectoryClient
        schoolDomain={params.schoolDomain}
        schoolName={school.name}
        walletBalance={school.walletBalance}
        departments={school.departments}
        staff={school.staff}
      />

      {/* OPERATIONAL FORMS: NEW DEPT & GENERATE PAYROLL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ADD DEPARTMENT */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Building className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-800">Add Academic Department</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Group faculty and non-teaching personnel into academic departments (e.g., Mathematics, Sciences, Admin).
            </p>
          </div>

          <form action={handleCreateDepartmentAction} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              name="name" 
              placeholder="e.g. Humanities & Social Sciences" 
              className="border border-slate-300 rounded-lg p-2.5 text-sm w-full sm:flex-1 focus:ring-2 focus:ring-indigo-500 outline-none"
              required 
            />
            <button 
              type="submit" 
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-5 py-2.5 rounded-lg transition text-sm shadow-sm shrink-0"
            >
              Add Department
            </button>
          </form>
        </section>

        {/* GENERATE PAYROLL */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <PlusCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-800">Generate Salary Record</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Schedule or prepare a remuneration record for any staff member prior to disbursement.
          </p>

          <form action={handleGeneratePayrollAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Member</label>
              <select name="staffId" className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="">-- Choose Employee --</option>
                {school.staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.role}) {s.department ? `• ${s.department.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gross Salary Amount ($)</label>
                <input 
                  type="number" 
                  name="amount" 
                  step="0.01" 
                  min="0.01"
                  placeholder="e.g. 2500.00"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Payment Date</label>
                <input 
                  type="date" 
                  name="payDate" 
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition text-sm shadow-sm"
            >
              Generate Payroll Entry
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
