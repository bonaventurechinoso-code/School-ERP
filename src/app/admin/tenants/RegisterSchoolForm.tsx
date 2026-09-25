"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneInput } from "@/components/PhoneInput";
import { Plus, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createSchool } from "../actions";

export const ACADEMIC_TIERS_OPTIONS = [
  { id: "DAYCARE", label: "Daycare / Nursery" },
  { id: "PRIMARY", label: "Primary School" },
  { id: "SECONDARY", label: "Secondary School" },
  { id: "PRIMARY_SECONDARY", label: "Combined Primary & Secondary School" },
  { id: "COMBINED_NURSERY_PRIMARY_SECONDARY", label: "Combined Nursery, Primary & Secondary" },
  { id: "UNIVERSITY", label: "Higher Ed: University" },
  { id: "POLYTECHNIC", label: "Higher Ed: Polytechnic" },
  { id: "COLLEGE_OF_EDUCATION", label: "Higher Ed: College of Education" }
];

export default function RegisterSchoolForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    subdomain: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
    contactPhone: "",
  });

  const [selectedTiers, setSelectedTiers] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleTierToggle = (tierId: string) => {
    setSelectedTiers((prev) =>
      prev.includes(tierId) ? prev.filter((id) => id !== tierId) : [...prev, tierId]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation checks
    const trimmedName = formData.name.trim();
    const cleanSubdomain = formData.subdomain.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const trimmedEmail = formData.adminEmail.trim();

    if (!trimmedName || !cleanSubdomain || !trimmedEmail) {
      setErrorMsg("Please fill in all required fields (School Name, Subdomain, Admin Email).");
      return;
    }

    if (selectedTiers.length === 0) {
      setErrorMsg("Please select at least one academic tier.");
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setErrorMsg("Master administrative password must be at least 8 characters long.");
      return;
    }

    const hasUppercase = /[A-Z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(formData.password);
    if (!hasUppercase || !hasNumber || !hasSpecial) {
      setErrorMsg("Master administrative password must contain at least 1 uppercase letter, 1 numeric digit, and 1 special character.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify that both password entries are identical.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Send active form state payload to backend onboarding registration controller
      const res = await fetch("/api/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: trimmedName,
          subdomain: cleanSubdomain,
          adminEmail: trimmedEmail,
          contactPhone: formData.contactPhone.trim(),
          password: formData.password,
          tiers: selectedTiers,
        }),
      });

      const data = await res.json();

      if (!res.ok || (!data.success && !data.tenant)) {
        throw new Error(data.error || data.message || "Failed to register tenant.");
      }

      setSuccessMsg(`Tenant "${trimmedName}" (${cleanSubdomain}) successfully created!`);
      setFormData({
        name: "",
        subdomain: "",
        adminEmail: "",
        password: "",
        confirmPassword: "",
        contactPhone: "",
      });
      setSelectedTiers([]);
      router.refresh();
    } catch (err: any) {
      // Fallback: try server action createSchool if API endpoint had network issue
      try {
        const fallbackFormData = new FormData();
        fallbackFormData.append("name", trimmedName);
        fallbackFormData.append("subdomain", cleanSubdomain);
        fallbackFormData.append("adminEmail", trimmedEmail);
        fallbackFormData.append("contactPhone", formData.contactPhone.trim());
        fallbackFormData.append("password", formData.password);
        fallbackFormData.append("confirmPassword", formData.confirmPassword);
        selectedTiers.forEach((tier) => fallbackFormData.append("tiers", tier));

        await createSchool(fallbackFormData);
        setSuccessMsg(`Tenant "${trimmedName}" successfully provisioned!`);
        setFormData({
          name: "",
          subdomain: "",
          adminEmail: "",
          password: "",
          confirmPassword: "",
          contactPhone: "",
        });
        setSelectedTiers([]);
        router.refresh();
      } catch (fallbackErr: any) {
        setErrorMsg(err.message || fallbackErr.message || "An unexpected error occurred during tenant registration.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <div className="leading-snug">{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <div className="leading-snug">{successMsg}</div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
          School Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600"
          placeholder="e.g., Riverside High"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
          Subdomain / Slug *
        </label>
        <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-shadow">
          <span className="bg-slate-100 dark:bg-zinc-800 px-2.5 py-2.5 text-slate-500 dark:text-zinc-400 text-xs font-mono border-r border-slate-200 dark:border-zinc-800">
            bonaveeict.com.ng/
          </span>
          <input
            type="text"
            name="subdomain"
            value={formData.subdomain}
            onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") })}
            className="w-full bg-slate-50/50 dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 p-2.5 text-xs outline-none font-mono placeholder-slate-400 dark:placeholder-zinc-600"
            placeholder="riverside"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
          Admin Email *
        </label>
        <input
          type="email"
          name="adminEmail"
          value={formData.adminEmail}
          onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
          className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600"
          placeholder="admin@riverside.edu"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
          Create Master Administrative Password *
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 pr-9 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600"
            placeholder="Minimum 8 alphanumeric characters"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
          Confirm Password *
        </label>
        <div className="relative">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 pr-9 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600"
            placeholder="Re-enter password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
          Contact Phone
        </label>
        <PhoneInput
          name="contactPhone"
          value={formData.contactPhone}
          onValueChange={(val) => setFormData({ ...formData, contactPhone: val })}
          maxLength={14}
          className="w-full bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-2.5 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none placeholder-slate-400 dark:placeholder-zinc-600"
          placeholder="+155500000000"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
          Academic Tiers *
        </label>
        <div className="space-y-2 p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-800/30 border border-slate-200/80 dark:border-zinc-800/80 max-h-44 overflow-y-auto">
          {ACADEMIC_TIERS_OPTIONS.map((tier) => {
            const isChecked = selectedTiers.includes(tier.id);
            return (
              <label
                key={tier.id}
                className="flex items-start space-x-2.5 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    name="tiers"
                    value={tier.id}
                    checked={isChecked}
                    onChange={() => handleTierToggle(tier.id)}
                    className="rounded border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <span className="font-medium">{tier.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Clear, Functional Action Submission Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 text-xs transition-all mt-3 flex justify-center items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white dark:text-slate-900" />
            <span>Registering School Account...</span>
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            <span>Register School Account</span>
            <span className="text-[10px] opacity-70 font-normal ml-1">(Create Tenant)</span>
          </>
        )}
      </button>
    </form>
  );
}
