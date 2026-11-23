import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import { getSession } from "@/lib/auth";
import { TenantAuthActions } from "../../TenantAuthActions";
import { Building2, Bell, Calendar, Sparkles, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TenantNewsPage({
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

  const bulletins = [
    {
      id: "1",
      title: "2026/2027 Academic Session Admissions Now Open",
      date: "Academic Year 2026/2027",
      category: "Admissions",
      content:
        `Online admissions applications are now officially open for prospective learners at ${school.name}. Parents and guardians are invited to complete our streamlined online application.`,
      cta: { text: "Apply Online", href: "/apply" },
    },
    {
      id: "2",
      title: "Resumption & Term Academic Calendar Released",
      date: "Current Term",
      category: "Academic Calendar",
      content:
        "The academic calendar detailing term resumption dates, continuous assessment deadlines, midterm breaks, and terminal examination schedules has been published.",
      cta: { text: "View Admissions", href: "/apply" },
    },
    {
      id: "3",
      title: "Digital Portal & Continuous Assessment Monitoring",
      date: "Portal Notice",
      category: "Institutional",
      content:
        "All registered students and parents can monitor termly performance, download fee invoices, and track daily attendance register via the institutional portal.",
      cta: { text: "Portal Login", href: "/login" },
    },
  ];

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
              <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">News &amp; Bulletins</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <Link href="/" className="hover:text-indigo-600 transition">Home</Link>
            <Link href="/about" className="hover:text-indigo-600 transition">About</Link>
            <Link href="/#programs" className="hover:text-indigo-600 transition">Programs</Link>
            <Link href="/apply" className="hover:text-indigo-600 transition">Admissions</Link>
            <Link href="/news" className="text-indigo-600">News</Link>
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

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Bell className="w-3.5 h-3.5" />
            <span>School Announcements</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            News &amp; Updates
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Stay updated with official bulletins, term timetables, and academic events from {school.name}.
          </p>
        </div>

        <div className="space-y-6">
          {bulletins.map((b) => (
            <div key={b.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3 hover:shadow-md transition">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {b.category}
                </span>
                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {b.date}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{b.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{b.content}</p>
              <div className="pt-2">
                <Link href={b.cta.href} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                  <span>{b.cta.text}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-xs border-t border-slate-800">
        <p>&copy; {new Date().getFullYear()} {school.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
