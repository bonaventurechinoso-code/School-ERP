import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { TenantAuthActions } from "../../TenantAuthActions";
import { Building2, ArrowRight, ShieldCheck, Award, BookOpen, Users, Phone, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TenantAboutPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string };
}) {
  const { schoolDomain } = await Promise.resolve(paramsPromise);
  const session = await getSession(undefined, schoolDomain).catch(() => null);

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolDomain },
    include: {
      academicTiers: { orderBy: { level: "asc" } },
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
  const schoolAddress = config.address || `${school.name} Campus, Nigeria`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
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
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">About Our Institution</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <Link href="/" className="hover:text-indigo-600 transition">Home</Link>
            <Link href="/about" className="text-indigo-600">About</Link>
            <Link href="/#programs" className="hover:text-indigo-600 transition">Programs</Link>
            <Link href="/apply" className="hover:text-indigo-600 transition">Admissions</Link>
            <Link href="/news" className="hover:text-indigo-600 transition">News</Link>
            <Link href="/contact" className="hover:text-indigo-600 transition">Contact</Link>
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

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Award className="w-3.5 h-3.5" />
            <span>Institutional Profile</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            About {school.name}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            {config.about ||
              `A center of academic rigor, character development, and holistic learner mentorship dedicated to inspiring Nigerian learners towards global excellence.`}
          </p>
        </div>

        {/* Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Academic Excellence</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Curricula rigorously aligned with national and international standards, continuously monitored for high student achievement.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Moral Character & Discipline</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Instilling integrity, mutual respect, civic responsibility, and leadership qualities in every learner.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Dedicated Faculty</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Experienced, TRCN-certified educators and supportive staff passionate about child development and mentorship.
            </p>
          </div>
        </div>

        {/* Academic Pathways */}
        {school.academicTiers.length > 0 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-6">
            <h3 className="text-xl font-bold text-slate-900">Educational Pathways Offered</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {school.academicTiers.map((t) => (
                <div key={t.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800">{t.name}</span>
                  <Link href={`/apply?tier=${encodeURIComponent(t.id)}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                    Apply <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="p-8 rounded-3xl bg-indigo-900 text-white text-center space-y-4">
          <h3 className="text-2xl font-bold">Join the {school.name} Family</h3>
          <p className="text-indigo-200 text-sm max-w-lg mx-auto">
            Applications are currently being reviewed for the upcoming academic session.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link href="/apply" className="px-6 py-3 bg-white text-indigo-900 font-bold rounded-xl text-sm shadow hover:bg-indigo-50 transition">
              Apply Online Now
            </Link>
            <Link href="/contact" className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm border border-white/20 transition">
              Contact Us
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-xs border-t border-slate-800">
        <p>&copy; {new Date().getFullYear()} {school.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
