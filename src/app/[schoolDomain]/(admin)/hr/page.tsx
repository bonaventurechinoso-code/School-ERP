import { basePrisma } from "@/lib/tenant-prisma";
import { createDepartment, generatePayroll, voidPayroll, disbursePayroll } from "./actions";
import BankDetailsForm from "./BankDetailsForm";

export default async function HRPayrollPage({
  params
}: {
  params: { schoolDomain: string }
}) {
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      departments: true,
      staff: {
        include: { department: true, PayrollRecord: true }
      }
    }
  });

  if (!school) return <div>Tenant Not Found</div>;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-800">HR & Payroll Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* DEPARTMENTS SECTION */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-semibold mb-4 text-slate-700">Departments</h3>
          <ul className="mb-4 space-y-2">
            {school.departments.length === 0 ? (
              <li className="text-slate-500">No departments found.</li>
            ) : (
              school.departments.map(dept => (
                <li key={dept.id} className="p-3 bg-slate-50 rounded border text-slate-700">
                  {dept.name}
                </li>
              ))
            )}
          </ul>
          
          <form action={createDepartment.bind(null, params.schoolDomain)} className="flex gap-2">
            <input 
              type="text" 
              name="name" 
              placeholder="New Dept Name" 
              className="border p-2 rounded flex-1"
              required 
            />
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800">
              Add
            </button>
          </form>
        </section>

        {/* PAYROLL SECTION */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-xl font-semibold mb-4 text-slate-700">Generate Payroll</h3>
          <form action={generatePayroll.bind(null, params.schoolDomain)} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Staff Member</label>
              <select name="staffId" className="w-full border p-2 rounded" required>
                <option value="">Select Staff...</option>
                {school.staff.map(s => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.role})</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-slate-600 mb-1">Amount</label>
                <input type="number" name="amount" step="0.01" className="w-full border p-2 rounded" required />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-slate-600 mb-1">Pay Date</label>
                <input type="date" name="payDate" className="w-full border p-2 rounded" required />
              </div>
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800">
              Generate Payroll Record
            </button>
          </form>
        </section>
      </div>

      {/* STAFF DIRECTORY WITH PAYROLL */}
      <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-semibold mb-4 text-slate-700">Staff & Payroll History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="p-3 font-semibold">Name</th>
                <th className="p-3 font-semibold">Role</th>
                <th className="p-3 font-semibold">Department</th>
                <th className="p-3 font-semibold">Bank Details</th>
                <th className="p-3 font-semibold">Recent Payments</th>
              </tr>
            </thead>
            <tbody>
              {school.staff.map(s => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="p-3">{s.firstName} {s.lastName}</td>
                  <td className="p-3">{s.role}</td>
                  <td className="p-3">{s.department?.name || "N/A"}</td>
                  <td className="p-3 text-xs">
                    <BankDetailsForm staff={s} schoolDomain={params.schoolDomain} />
                  </td>
                  <td className="p-3">
                    {s.PayrollRecord.length === 0 ? (
                      <span className="text-slate-400">No records</span>
                    ) : (
                      <ul className="space-y-1">
                        {s.PayrollRecord.map(pr => (
                          <li key={pr.id} className="flex items-center gap-2">
                            <span>
                              ${pr.amount.toFixed(2)} on {new Date(pr.payDate).toLocaleDateString()}
                            </span>
                            {pr.status === 'PENDING' ? (
                              <form action={disbursePayroll.bind(null, params.schoolDomain, pr.id)} className="inline">
                                <button type="submit" className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200">
                                  Disburse Funds
                                </button>
                              </form>
                            ) : (
                              <span className={`px-2 py-0.5 text-xs rounded-full ${pr.status.includes('DISBURSED') ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {pr.status} {pr.receiptCode && <span className="ml-1 opacity-75 font-mono text-[10px]">#{pr.receiptCode}</span>}
                              </span>
                            )}
                            <form action={voidPayroll.bind(null, params.schoolDomain, pr.id)}>
                              <button type="submit" className="text-red-500 hover:text-red-700 font-bold px-1" title="Void Payment">
                                ×
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
