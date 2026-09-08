"use client";

import { useState, useTransition } from "react";
import { logMessage } from "./actions";
import { useTenant } from "@/lib/tenant-context";

type MessageLogViewProps = {
  schoolId: string;
  messageLogs: any[];
  students: any[];
  staff: any[];
};

export default function MessageLogView({ schoolId, messageLogs, students, staff }: MessageLogViewProps) {
  const tenant = useTenant();
  const isHigherEd = tenant.institutionType === "HIGHER_ED";
  
  const [isPending, startTransition] = useTransition();
  const [showSimulate, setShowSimulate] = useState(false);
  const [formData, setFormData] = useState({
    recipientType: "STUDENT",
    messageType: "EMAIL",
    recipientEmail: "",
    subject: "",
    body: ""
  });

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await logMessage(schoolId, formData);
      if (res?.success) {
        setShowSimulate(false);
        setFormData({ recipientType: "STUDENT", messageType: "EMAIL", recipientEmail: "", subject: "", body: "" });
      } else {
        alert(res?.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 w-full text-center sm:text-left">Direct Message Audit Logs</h3>
        <button 
          onClick={() => setShowSimulate(!showSimulate)}
          className="w-full sm:w-auto text-sm px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 transition font-medium"
        >
          {showSimulate ? "Cancel Simulation" : "Simulate Outbound Message"}
        </button>
      </div>

      {showSimulate && (
        <form onSubmit={handleSimulate} className="bg-slate-50 p-6 rounded-xl border border-slate-200 grid grid-cols-1 gap-4">
          <p className="text-sm text-slate-500 mb-2">Use this form to simulate an email/message being sent by the system to a student or staff member. It will be recorded in the audit log below.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message Type</label>
              <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.messageType} onChange={e => setFormData({...formData, messageType: e.target.value})}>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS Notification</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Group</label>
              <select className="w-full border border-slate-300 rounded-lg p-2" value={formData.recipientType} onChange={e => setFormData({...formData, recipientType: e.target.value, recipientEmail: ""})}>
                <option value="STUDENT">Student</option>
                <option value="STAFF">{isHigherEd ? "Faculty & Staff" : "Staff Member"}</option>
                <option value="PARENT">{isHigherEd ? "Sponsor / Next of Kin" : "Parent / Guardian"}</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Contact</label>
              <select required className="w-full border border-slate-300 rounded-lg p-2" value={formData.recipientEmail} onChange={e => setFormData({...formData, recipientEmail: e.target.value})}>
                <option value="">-- Choose from Directory --</option>
                {formData.recipientType === "STUDENT" && students.filter(s => s.email).map(s => (
                  <option key={s.id} value={s.email!}>{s.firstName} {s.lastName} ({s.email})</option>
                ))}
                {formData.recipientType === "STAFF" && staff.filter(s => s.email).map(s => (
                  <option key={s.id} value={s.email}>{s.firstName} {s.lastName} ({s.email})</option>
                ))}
                {formData.recipientType === "PARENT" && students.filter(s => s.parentEmail).map(s => (
                  <option key={s.id} value={s.parentEmail!}>
                    {isHigherEd ? "Sponsor" : "Parent"} of {s.firstName} {s.lastName} ({s.parentEmail})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject / Header</label>
              <input required type="text" placeholder="Important Update" className="w-full border border-slate-300 rounded-lg p-2" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
            <textarea required rows={3} className="w-full border border-slate-300 rounded-lg p-2" value={formData.body} onChange={e => setFormData({...formData, body: e.target.value})}></textarea>
          </div>

          <div className="flex flex-col sm:flex-row justify-end mt-2">
            <button disabled={isPending} type="submit" className="w-full sm:w-auto px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-50">
              {isPending ? "Logging..." : "Log Message"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-semibold">Timestamp</th>
              <th className="px-6 py-4 font-semibold">Type</th>
              <th className="px-6 py-4 font-semibold">Recipient Group</th>
              <th className="px-6 py-4 font-semibold">Contact Email</th>
              <th className="px-6 py-4 font-semibold">Subject & Body Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {messageLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No outbound messages logged yet.
                </td>
              </tr>
            ) : (
              messageLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                    {new Date(log.sentAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${log.messageType === 'SMS' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {log.messageType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                      {log.recipientType}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {log.recipientEmail}
                  </td>
                  <td className="px-6 py-4 text-slate-500 max-w-xs">
                    <div className="font-medium text-slate-800 truncate">{log.subject}</div>
                    <div className="truncate text-xs">{log.body}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
