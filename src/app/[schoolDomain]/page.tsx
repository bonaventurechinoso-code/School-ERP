import { basePrisma } from "@/lib/tenant-prisma";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { generateTierMockData, formatTierLabel, getHeroImage } from "@/lib/guestPortalUtils";
import { 
  Building2, 
  Phone, 
  Mail, 
  ArrowRight, 
  GraduationCap, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Users, 
  BookOpen,
  Layers
} from "lucide-react";

function getTierCurriculumDetails(tierName: string) {
  const upper = tierName.toUpperCase();
  if (upper.includes("NURSERY") || upper.includes("DAYCARE") || upper.includes("CRECHE") || upper.includes("EARLY")) {
    return {
      title: tierName || "Daycare & Early Nursery",
      badge: "Ages 0 - 5",
      badgeColor: "bg-pink-50 text-pink-700 border-pink-200",
      description: "A nurturing environment fostering early literacy, psychomotor development, phonics, and play-based cognitive milestones under dedicated caregiver guidance.",
      highlights: ["Play-based Learning", "Phonics & Sensory Skills", "Safe & Stimulating Playgrounds", "Daily Caregiver Journal"]
    };
  }
  if (upper.includes("PRIMARY") || upper.includes("BASIC") || upper.includes("ELEMENTARY")) {
    return {
      title: tierName || "Primary & Basic Education",
      badge: "Basic 1 - 6",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      description: "Comprehensive foundational education emphasizing core literacy, numeracy, introductory STEM, moral instruction, and continuous assessment.",
      highlights: ["Core English & Mathematics", "Introductory Science & ICT", "Creative Arts & Cultural Studies", "Continuous Assessment (C.A.)"]
    };
  }
  if (upper.includes("SECONDARY") || upper.includes("HIGH") || upper.includes("GRAMMAR") || (upper.includes("COLLEGE") && !upper.includes("EDUCATION"))) {
    return {
      title: tierName || "Junior & Senior Secondary",
      badge: "JSS 1 - SSS 3",
      badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "Rigorous academic discipline preparing students for WAEC (WASSCE), NECO (SSCE), and JAMB (UTME) across Science, Arts, and Commercial streams.",
      highlights: ["WAEC, NECO & JAMB Preparation", "Equipped Science & Computer Labs", "Arts, Commercial & Science Streams", "Leadership & Career Mentorship"]
    };
  }
  if (upper.includes("POLYTECHNIC")) {
    return {
      title: tierName || "Polytechnic & Technology",
      badge: "ND & HND",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "Industry-aligned vocational and technical diplomas equipping students with practical engineering, technological, and entrepreneurial skills.",
      highlights: ["Practical Workshops & Tech Labs", "SIWES / Industrial Training", "Professional Accreditations", "Applied Entrepreneurship"]
    };
  }
  if (upper.includes("COLLEGE OF EDUCATION")) {
    return {
      title: tierName || "College of Education",
      badge: "NCE Programs",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      description: "Specialized instructional pedagogy, child psychology, and subject-matter certification preparing qualified professional educators.",
      highlights: ["Supervised Teaching Practice", "Modern Educational Technology", "Early Childhood & Secondary Tracks", "TRCN Certification Readiness"]
    };
  }
  // Default / Tertiary / University
  return {
    title: tierName || "Undergraduate Studies",
    badge: "Degree Programs",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Accredited undergraduate and postgraduate curricula engineered for research, academic excellence, innovation, and professional leadership.",
    highlights: ["Accredited Degree Programs", "Research & Lab Infrastructure", "Internships & Career Placement", "Global Alumni Network"]
  };
}

export default async function PublicGuestPortalPage({
  params: paramsPromise,
}: {
  params: Promise<{ schoolDomain: string }> | { schoolDomain: string };
}) {
  const { schoolDomain } = await Promise.resolve(paramsPromise);
  let school = null;
  try {
    school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain },
      include: {
        academicTiers: {
          orderBy: { level: "asc" }
        },
        staff: {
          take: 1,
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  } catch (error) {
    console.error("Tenant DB fetch error:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200 max-w-md">
          <h2 className="text-xl font-bold text-slate-800">Tenant Offline / Under Maintenance</h2>
          <p className="mt-2 text-sm text-slate-600">
            We are unable to connect to this tenant&apos;s metadata context at the moment. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!school) {
    return notFound();
  }

  if (!school.isPublicPortalEnabled) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{school.name}</h1>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
            Portal Under Scheduled Maintenance
          </div>
          <p className="text-slate-500 text-sm leading-relaxed">
            The public portal and online admissions gateway for this institution are currently offline. 
            Please contact the school administration or call the helpline below.
          </p>
          {school.contactPhone && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
              <Phone className="w-4 h-4 text-indigo-600" />
              <span>Helpline: {school.contactPhone}</span>
            </div>
          )}
          <div className="pt-2">
            <Link
              href={`/${school.subdomain}/login`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              <span>Staff & Administrator Sign In</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Resolve precise tier based on academicTiers for clean nomenclature
  let preciseTier = "PRIMARY";
  const schoolNameUpper = school.name.toUpperCase();
  if (school.academicTiers.length > 0) {
    const tierNames = school.academicTiers.map(t => t.name.toUpperCase());
    if (tierNames.some(t => t.includes("UNIVERSITY"))) preciseTier = "UNIVERSITY";
    else if (tierNames.some(t => t.includes("POLYTECHNIC"))) preciseTier = "POLYTECHNIC";
    else if (tierNames.some(t => t.includes("COLLEGE OF EDUCATION"))) preciseTier = "COLLEGE_OF_EDUCATION";
    else if (tierNames.some(t => t.includes("PRIMARY")) && tierNames.some(t => t.includes("SECONDARY"))) preciseTier = "PRIMARY_SECONDARY";
    else if (tierNames.some(t => t.includes("SECONDARY"))) preciseTier = "SECONDARY";
    else if (tierNames.some(t => t.includes("PRIMARY"))) preciseTier = "PRIMARY";
    else if (tierNames.some(t => t.includes("NURSERY") || t.includes("DAYCARE"))) preciseTier = "NURSERY";
  } else {
    if (schoolNameUpper.includes("UNIVERSITY")) preciseTier = "UNIVERSITY";
    else if (schoolNameUpper.includes("POLYTECHNIC")) preciseTier = "POLYTECHNIC";
    else if (schoolNameUpper.includes("SECONDARY") || schoolNameUpper.includes("HIGH")) preciseTier = "SECONDARY";
    else if (schoolNameUpper.includes("PRIMARY")) preciseTier = "PRIMARY";
    else if (schoolNameUpper.includes("NURSERY") || schoolNameUpper.includes("CRECHE")) preciseTier = "NURSERY";
  }

  const { heroTitle, aboutUs } = generateTierMockData(preciseTier, school.name);
  
  // Use custom welcome greeting if provided and different from default
  const finalHeroTitle = (school.welcomeGreeting && school.welcomeGreeting !== "Welcome to our institution!") 
    ? school.welcomeGreeting 
    : heroTitle;
  
  const contactEmail = school.staff.length > 0 ? school.staff[0].email : "admissions@school.local";
  const contactPhone = school.contactPhone || "+234 (0) 800 000 0000";
  
  // Resolve tier-specific hero background image
  const heroImageUrl = getHeroImage(preciseTier, (school as any).metadata?.customHeroImage);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Top Admissions Helpline Ribbon */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">2026/2027 Academic Session Admissions Open</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <a 
              href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`} 
              className="inline-flex items-center gap-1.5 hover:text-white transition font-medium"
            >
              <Phone className="w-3 h-3 text-indigo-400" />
              <span>Helpline: <strong className="text-white font-mono">{contactPhone}</strong></span>
            </a>
            <span className="text-slate-700 hidden sm:inline">|</span>
            <a 
              href={`mailto:${contactEmail}`} 
              className="inline-flex items-center gap-1.5 hover:text-white transition font-medium hidden sm:inline-flex"
            >
              <Mail className="w-3 h-3 text-indigo-400" />
              <span>{contactEmail}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">{school.name}</h1>
              <p className="text-[11px] sm:text-xs font-semibold text-indigo-600 uppercase tracking-widest truncate">
                Academic & Student Admissions Portal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link 
              href={`/${school.subdomain}/portal/student`}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-semibold transition-all text-xs sm:text-sm border border-indigo-200 shadow-xs"
            >
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
              <span>Student<span className="hidden sm:inline"> Workspace</span></span>
            </Link>
            <Link 
              href={`/${school.subdomain}/login`}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-all shadow-xs text-xs sm:text-sm border border-slate-800"
            >
              <span>Staff<span className="hidden sm:inline"> Login</span></span>
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="relative w-full min-h-[580px] overflow-hidden bg-slate-950 text-white flex items-center">
          {/* Full Background Image */}
          <div className="absolute inset-0 w-full h-full z-0">
            <Image 
              src={heroImageUrl} 
              fill
              priority
              className="object-cover" 
              alt={`${school.name} Campus`} 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/80 to-slate-900/75 pointer-events-none" />
          </div>

          <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex flex-col items-center justify-center text-center py-20 md:py-28">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-200 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Official Institutional Portal</span>
            </div>

            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight text-white drop-shadow-lg max-w-4xl">
              {finalHeroTitle}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-200 mb-10 max-w-3xl leading-relaxed mx-auto drop-shadow-md">
              {aboutUs}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
              <Link 
                href={`/${school.subdomain}/apply`}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-base sm:text-lg shadow-xl hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5"
              >
                <span>Apply Online / Start New Application</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a 
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-base sm:text-lg transition-all backdrop-blur-sm border border-white/15"
              >
                <Phone className="w-4 h-4 text-indigo-300" />
                <span>Contact Admissions</span>
              </a>
            </div>

            {/* Direct Gateway Badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs text-slate-300 font-medium">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Direct Gateways:</span>
              <Link 
                href={`/${school.subdomain}/portal/student`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 transition backdrop-blur-xs font-semibold"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student Workspace</span>
              </Link>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <Link 
                href={`/${school.subdomain}/login`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 border border-white/20 transition backdrop-blur-xs font-semibold"
              >
                <span>Staff & Teacher Sign In</span>
              </Link>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <Link 
                href={`/${school.subdomain}/apply`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 transition backdrop-blur-xs font-semibold"
              >
                <span>New Applicant Enrollment</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Dynamic Academic Programs (Tiers) */}
        {school.academicTiers.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 mb-3">
                <Layers className="w-3.5 h-3.5" />
                <span>Curriculum Pathways</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Our Academic Programs
              </h3>
              <p className="text-slate-600 max-w-2xl mx-auto mt-2 text-sm sm:text-base leading-relaxed">
                Explore the diverse educational pathways offered at {school.name}, structured to foster intellectual maturity and character at every developmental milestone.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {school.academicTiers.map((tier) => {
                const details = getTierCurriculumDetails(tier.name);
                return (
                  <div 
                    key={tier.id} 
                    className="bg-white p-7 rounded-2xl shadow-xs border border-slate-200 hover:shadow-lg hover:border-indigo-200 transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${details.badgeColor}`}>
                          {details.badge}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Accredited Pathway
                        </span>
                      </div>

                      <h4 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-3">
                        {details.title}
                      </h4>

                      <p className="text-slate-600 text-sm leading-relaxed mb-6">
                        {details.description}
                      </p>

                      <div className="space-y-2 border-t border-slate-100 pt-4 mb-6">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                          Key Curriculum Highlights
                        </span>
                        {details.highlights.map((hl, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{hl}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <Link 
                        href={`/${school.subdomain}/apply?tier=${encodeURIComponent(tier.id)}`}
                        className="inline-flex items-center justify-between w-full py-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        <span>Apply for {tier.name}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer & Contact Card */}
      <footer id="contact" className="bg-slate-900 text-slate-300 py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12">
          
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white">{school.name}</h2>
            </div>
            <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
              Unified institutional portal servicing student academic workspaces, staff operations, and online admissions enrollment.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1 mb-6">
              <Link
                href={`/${school.subdomain}/portal/student`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Student Workspace</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href={`/${school.subdomain}/login`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 text-xs font-semibold transition-colors"
              >
                <span>Staff Portal</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-sm">
            <h3 className="text-base font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-400" />
              <span>Contact & Enquiries</span>
            </h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Admissions Hotline</p>
                  <a 
                    href={`tel:${contactPhone.replace(/[^0-9+]/g, '')}`} 
                    className="text-white font-mono font-medium hover:text-indigo-400 transition-colors text-sm"
                  >
                    {contactPhone}
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Us</p>
                  <a 
                    href={`mailto:${contactEmail}`} 
                    className="text-white font-medium hover:text-indigo-400 transition-colors text-sm"
                  >
                    {contactEmail}
                  </a>
                </div>
              </li>
            </ul>
          </div>
          
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} {school.name}. All rights reserved. Unified Student, Staff & Admissions Portal • Powered by SchoolERP.</p>
        </div>
      </footer>
    </div>
  );
}
