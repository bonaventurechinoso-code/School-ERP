import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { TenantAuthActions } from "../../TenantAuthActions";
import { Building2, Phone, Mail, MapPin, Clock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TenantContactPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string };
}) {
  const { schoolDomain } = await Promise.resolve(paramsPromise);
  const session = await getSession(undefined, schoolDomain).catch(() => null);

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain },
    include: {
      staff: { take: 1, orderBy: { createdAt: "asc" } },
    },
  });

  if (!school) return notFound();

  const isAuthedUser = Boolean(
    session &&
    session.userId &&
    session.role &&
    session.role !== "GUEST_APPLICANT" &&
    session.role !== "GUEST" &&
    session.role !== "APPLICANT"
  );

  let workspaceHref = `/portal`;
  if (isAuthedUser && session) {
    const role = (session.role || "").toUpperCase();
    if (role === "STUDENT") workspaceHref = `/portal/student`;
    else if (role === "PARENT") workspaceHref = `/portal/parent`;
    else if (role === "TEACHER" || role === "STAFF") workspaceHref = `/portal/staff`;
    else if (role === "BURSAR") workspaceHref = `/portal/bursar`;
    else if (role === "PRINCIPAL" || role === "HEADMASTER" || role === "VICE_PRINCIPAL") workspaceHref = `/portal/principal`;
    else if (role === "SUPER_ADMIN") workspaceHref = `/super-admin`;
    else workspaceHref = `/dashboard`;
  }

  const config = (school.tierDatabasesConfig as any) || {};
  const contactPhone = school.contactPhone || "+234 (0) 800 000 0000";
  const contactEmail = school.staff[0]?.email || `admissions@${school.subdomain}.bonaveeict.com.ng`;
  const schoolAddress = config.address || `${school.name} Main Campus, Nigeria`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[4.5rem] py-2.5 flex justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            {school.logo ? (
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-white p-1">
                <Image src={school.logo} alt={school.name} fill sizes="40px" className="object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold">
                <Building2 className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">{school.name}</h1>
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">Contact &amp; Inquiries</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <Link href="/" className="hover:text-indigo-600 transition">Home</Link>
            <Link href="/about" className="hover:text-indigo-600 transition">About</Link>
            <Link href="/#programs" className="hover:text-indigo-600 transition">Programs</Link>
            <Link href="/apply" className="hover:text-indigo-600 transition">Admissions</Link>
            <Link href="/news" className="hover:text-indigo-600 transition">News</Link>
            <Link href="/contact" className="text-indigo-600">Contact</Link>
          </nav>

          <TenantAuthActions
            initialIsAuthed={isAuthedUser}
            workspaceHref={workspaceHref}
            email={session?.email}
            subdomain={school.subdomain}
            variant="header"
          />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Phone className="w-3.5 h-3.5" />
            <span>Admissions Desk</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Contact {school.name}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Get in touch with our admissions officers, administrative desk, or visit our school premises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Campus Address</h4>
                <p className="text-sm font-semibold text-slate-800 mt-1">{schoolAddress}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pt-4 border-t border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Admissions Telephone</h4>
                <a href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`} className="text-sm font-semibold font-mono text-slate-800 hover:text-indigo-600 mt-1 block">
                  {contactPhone}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 pt-4 border-t border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Official Email</h4>
                <a href={`mailto:${contactEmail}`} className="text-sm font-semibold text-slate-800 hover:text-indigo-600 mt-1 block">
                  {contactEmail}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4 pt-4 border-t border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Administrative Hours</h4>
                <p className="text-sm text-slate-700 mt-1 font-medium">Monday &ndash; Friday: 7:30 AM &ndash; 4:00 PM</p>
              </div>
            </div>
          </div>

          <div className="bg-indigo-900 text-white p-8 rounded-2xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-wider text-indigo-300 font-extrabold">Online Admissions Portal</span>
              <h3 className="text-2xl font-bold">Ready to Enroll?</h3>
              <p className="text-sm text-indigo-200 leading-relaxed">
                Take the next step in your child&apos;s education by completing our online application or tracking an existing submission.
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-indigo-800">
              <Link href="/apply" className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-indigo-900 text-xs font-bold shadow hover:bg-indigo-50 transition">
                <span>Start New Application</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/admissions/track" className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 text-white text-xs font-bold border border-white/20 hover:bg-white/20 transition">
                <span>Track Application Status</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-xs border-t border-slate-800">
        <p>&copy; {new Date().getFullYear()} {school.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
