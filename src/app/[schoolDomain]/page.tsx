import { basePrisma } from "@/lib/tenant-prisma";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { generateTierMockData, getHeroImage } from "@/lib/guestPortalUtils";
import { TenantAuthActions } from "./TenantAuthActions";
import RegisterTenantPage from "@/app/(public)/register/page";
import OnboardingPage from "@/app/onboarding/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { 
  Building2, 
  Phone, 
  Mail, 
  ArrowRight, 
  GraduationCap, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  BookOpen,
  Layers,
  MapPin,
  Calendar,
  Award
} from "lucide-react";

function getTierCurriculumDetails(tierName: string) {
  const upper = tierName.toUpperCase();
  if (upper.includes("NURSERY") || upper.includes("CRECHE") || upper.includes("EARLY")) {
    return {
      title: tierName || "Creche & Early Nursery",
      badge: "Ages 0 - 5",
      badgeColor: "bg-pink-50 text-pink-700 border-pink-200",
      description: "A nurturing environment fostering early literacy, psychomotor development, phonics, and play-based cognitive milestones under dedicated caregiver guidance.",
      highlights: ["Play-based Learning", "Phonics & Sensory Skills", "Safe & Stimulating Playgrounds", "Daily Caregiver Journal"]
    };
  }
  if (upper.includes("PRIMARY") || upper.includes("BASIC") || upper.includes("ELEMENTARY")) {
    return {
      title: tierName || "Primary Education",
      badge: "Primary 1 - 6",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}) {
  const { schoolDomain } = await Promise.resolve(paramsPromise);
  const normalized = (schoolDomain || "").toLowerCase().trim();
  if (normalized === "register") {
    return <RegisterTenantPage />;
  }
  if (normalized === "onboarding") {
    return <OnboardingPage />;
  }
  if (normalized === "login") {
    redirect("/login");
  }
  if (normalized === "forgot-password") {
    redirect("/forgot-password");
  }
  if (normalized === "reset-password") {
    redirect("/reset-password");
  }
  if (normalized === "admin" || normalized === "super-admin") {
    redirect("/super-admin");
  }
  if (normalized === "portal-not-found") {
    redirect("/portal-not-found");
  }
  if (normalized === "access-denied") {
    redirect("/access-denied");
  }

  const isDemo = normalized === "demo" || normalized === "sandbox";

  const session = await getSession(undefined, schoolDomain).catch(() => null);

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
    if (role === "STUDENT") {
      workspaceHref = `/portal/student`;
    } else if (role === "PARENT") {
      workspaceHref = `/portal/parent`;
    } else if (role === "TEACHER" || role === "STAFF") {
      workspaceHref = `/portal/staff`;
    } else if (role === "BURSAR") {
      workspaceHref = `/portal/bursar`;
    } else if (role === "PRINCIPAL" || role === "HEADMASTER" || role === "VICE_PRINCIPAL") {
      workspaceHref = `/portal/principal`;
    } else if (role === "SUPER_ADMIN") {
      workspaceHref = `/super-admin`;
    } else {
      workspaceHref = `/dashboard`;
    }
  }

  let school = null;
  try {
    const normalizedDomain = schoolDomain.toLowerCase().trim();
    school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { subdomain: { equals: normalizedDomain, mode: "insensitive" } },
          { slug: { equals: normalizedDomain, mode: "insensitive" } },
        ],
      },
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

    // Resilient fallback: match without hyphens (e.g., 'capitalcity' matches 'capital-city')
    if (!school) {
      const cleanSub = normalizedDomain.replace(/[^a-z0-9]/g, "");
      const allSchools = await basePrisma.school.findMany({
        select: { id: true, subdomain: true, slug: true },
      });
      const match = allSchools.find((s) => {
        const sub = (s.subdomain || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const slg = (s.slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return sub === cleanSub || slg === cleanSub;
      });
      if (match) {
        school = await basePrisma.school.findUnique({
          where: { id: match.id },
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
      }
    }
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
    else if (tierNames.some(t => t.includes("NURSERY") || t.includes("CRECHE"))) preciseTier = "NURSERY";
  } else {
    if (schoolNameUpper.includes("UNIVERSITY")) preciseTier = "UNIVERSITY";
    else if (schoolNameUpper.includes("POLYTECHNIC")) preciseTier = "POLYTECHNIC";
    else if (schoolNameUpper.includes("SECONDARY") || schoolNameUpper.includes("HIGH")) preciseTier = "SECONDARY";
    else if (schoolNameUpper.includes("PRIMARY")) preciseTier = "PRIMARY";
    else if (schoolNameUpper.includes("NURSERY") || schoolNameUpper.includes("CRECHE")) preciseTier = "NURSERY";
  }

  const { heroTitle, aboutUs } = generateTierMockData(preciseTier, school.name);
  
  const demoDescription =
    preciseTier === "NURSERY"
      ? "A nurturing early childhood center dedicated to toddler milestone development, play-based literacy, and dedicated caregiver guidance."
      : preciseTier === "PRIMARY"
      ? "A foundational primary institution fostering literacy, numeracy, academic discipline, and future Nigerian leaders."
      : preciseTier === "SECONDARY"
      ? "A premier secondary institution preparing students for WAEC, NECO, and JAMB through comprehensive academic and moral discipline."
      : "A premium institution dedicated to global research, academic innovation, and professional competency.";
  const finalAboutUs = isDemo ? demoDescription : aboutUs;

  // Use custom welcome greeting if provided and different from default
  const finalHeroTitle = isDemo
    ? `Welcome to ${school.name}`
    : ((school.welcomeGreeting && school.welcomeGreeting !== "Welcome to our institution!") 
      ? school.welcomeGreeting 
      : heroTitle);
  const contactEmail = school.staff.length > 0 ? school.staff[0].email : `admissions@${school.subdomain}.bonaveeict.com.ng`;
  const contactPhone = school.contactPhone || "+234 (0) 800 000 0000";
  
  // Resolve institutional branding media (custom hero image/video & logo)
  const schoolConfig = (school.tierDatabasesConfig as any) || {};
  const customHeroType: "image" | "video" =
    schoolConfig.customHeroType || (schoolConfig.customHeroVideo ? "video" : "image");
  const customHeroVideo: string | null = schoolConfig.customHeroVideo || null;
  const customHeroImage: string | null =
    schoolConfig.customHeroImage || (school as any).metadata?.customHeroImage || null;

  // Resolve tier-specific hero background image with verified local fallback
  const fallbackCampusImage = "/hero-bg.jpg";
  const heroImageUrl = customHeroImage
    ? customHeroImage
    : isDemo
    ? fallbackCampusImage
    : (getHeroImage(preciseTier) || fallbackCampusImage);

  const schoolAddress = schoolConfig.address || `${school.name} Campus, Nigeria`;

  // Fallback tiers if none created in database yet
  const fallbackTiers = [
    {
      id: "default-tier-1",
      name:
        preciseTier === "NURSERY"
          ? "Nursery & Kindergarten"
          : preciseTier === "SECONDARY"
          ? "Junior & Senior Secondary"
          : "Primary Basic Education",
    },
  ];
  const effectiveTiers = school.academicTiers.length > 0 ? school.academicTiers : fallbackTiers;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      
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
            {session?.email && (
              <>
                <span className="text-slate-700 hidden sm:inline">|</span>
                <span className="inline-flex items-center gap-1.5 text-indigo-200 font-medium hidden sm:inline-flex">
                  <Mail className="w-3 h-3 text-indigo-400" />
                  <span>{session.email}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[5rem] py-2.5 flex justify-between items-center gap-3 sm:gap-4">
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 group">
            {school.logo ? (
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-white shrink-0 flex items-center justify-center p-1">
                <Image
                  src={school.logo}
                  alt={`${school.name} Logo`}
                  fill
                  sizes="48px"
                  className="object-contain"
                  unoptimized={true}
                />
              </div>
            ) : (
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                {school.name}
              </h1>
              <p className="text-[11px] sm:text-xs font-semibold text-indigo-600 uppercase tracking-wide leading-tight mt-0.5">
                Official Institutional Portal
              </p>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <Link href="/" className="text-indigo-600 font-bold">Home</Link>
            <Link href="#about" className="hover:text-indigo-600 transition">About</Link>
            <Link href="#programs" className="hover:text-indigo-600 transition">Programs</Link>
            <Link href="#admissions" className="hover:text-indigo-600 transition">Admissions</Link>
            <Link href="#news" className="hover:text-indigo-600 transition">News</Link>
            <Link href="#contact" className="hover:text-indigo-600 transition">Contact</Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <TenantAuthActions
              initialIsAuthed={isAuthedUser}
              workspaceHref={workspaceHref}
              email={session?.email}
              subdomain={school.subdomain}
              variant="header"
            />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="relative w-full min-h-[580px] overflow-hidden bg-slate-950 text-white flex items-center">
          {/* Background Media */}
          <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
            {customHeroType === "video" && customHeroVideo ? (
              <video
                key={customHeroVideo}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="w-full h-full object-cover"
              >
                <source
                  src={customHeroVideo}
                  type={customHeroVideo.endsWith(".webm") ? "video/webm" : "video/mp4"}
                />
              </video>
            ) : (
              <Image 
                src={heroImageUrl} 
                fill
                priority
                className="object-cover" 
                alt={`${school.name} Campus Premises`} 
                unoptimized={true}
              />
            )}
            <div className="absolute inset-0 bg-black/50 z-0 pointer-events-none" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 w-full flex flex-col items-center justify-center text-center py-20 md:py-28">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-indigo-200 mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>{schoolConfig.motto || "Inspiring Excellence, Character & Knowledge"}</span>
            </div>

            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] max-w-4xl">
              {finalHeroTitle}
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-white/95 mb-10 max-w-3xl leading-relaxed mx-auto drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] font-medium">
              {finalAboutUs}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto items-stretch sm:items-center">
              <Link 
                href="/apply"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white rounded-xl font-bold text-sm sm:text-base md:text-lg shadow-xl hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5"
              >
                <span>Apply Online / Start New Application</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              </Link>
              <Link 
                href="/admissions/track"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-white/15 hover:bg-white/25 active:scale-[0.99] text-white rounded-xl font-bold text-sm sm:text-base md:text-lg transition-all backdrop-blur-md border border-white/25 shadow-lg"
              >
                <span>Track Application</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Section 1: About Institution Overview */}
        <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24 border-b border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                <BookOpen className="w-3.5 h-3.5" />
                <span>About Our Institution</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Inspiring Academic Excellence, Discipline &amp; Future Nigerian Leaders
              </h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {schoolConfig.about || finalAboutUs}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Accredited Standards</span>
                  </div>
                  <p className="text-xs text-slate-500">Fully compliant with state ministry curricula and regulatory examination standards.</p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                    <Users className="w-4 h-4" />
                    <span>TRCN Certified Faculty</span>
                  </div>
                  <p className="text-xs text-slate-500">Passionate educators providing personalized academic and character mentorship.</p>
                </div>
              </div>
            </div>

            <div className="bg-indigo-900/5 rounded-3xl p-8 border border-indigo-100 space-y-6">
              <h4 className="text-lg font-bold text-slate-900">Why Families Choose {school.name}</h4>
              <ul className="space-y-4">
                {[
                  "Holistic education blending academic rigor, ICT literacy, and moral character.",
                  "Modern educational infrastructure, laboratory spaces, and sports facilities.",
                  "Continuous assessment tracking with transparent online portal access for parents.",
                  "Structured pathway for national examinations and global competence."
                ].map((point, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  <span>Learn more about our heritage &amp; vision</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Programs / Classes Offered */}
        <section id="programs" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24 border-b border-slate-200">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Curriculum Pathways</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Our Academic Programs &amp; Classes
            </h3>
            <p className="text-slate-600 max-w-2xl mx-auto mt-2 text-sm sm:text-base leading-relaxed">
              Explore the diverse educational pathways offered at {school.name}, structured to foster intellectual maturity and character at every developmental milestone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {effectiveTiers.map((tier) => {
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
                      href={`/apply?tier=${encodeURIComponent(tier.id)}`}
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
        </section>

        {/* Section 3: Admissions Gateway */}
        <section id="admissions" className="bg-slate-900 text-white py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-indigo-300 border border-white/15">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Admissions &amp; Enrollment</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Simple 3-Step Enrollment Gateway
              </h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                We welcome prospective pupils and students into an encouraging academic environment. Begin your enrollment in three simple steps.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                <h4 className="text-base font-bold text-white">Online Application</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Fill in candidate &amp; guardian particulars online, select designated academic tier, and submit safely without physical queues.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                <h4 className="text-base font-bold text-white">Assessment &amp; Screening</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Participate in learner readiness evaluation or entrance screening designed to determine appropriate classroom placement.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">3</span>
                <h4 className="text-base font-bold text-white">Admission Offer &amp; Intake</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Receive verified admission confirmation, print official student intake slip, and access online portal services.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/apply"
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base rounded-xl shadow-lg transition"
              >
                Apply Online Now
              </Link>
              <Link
                href="/admissions/track"
                className="px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm sm:text-base rounded-xl border border-white/20 transition"
              >
                Track Existing Application
              </Link>
            </div>
          </div>
        </section>

        {/* Section 4: News & Announcements */}
        <section id="news" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-24 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Notices &amp; Bulletins</span>
              </div>
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Institutional News &amp; Announcements
              </h3>
            </div>
            <Link href="/news" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              View all updates <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Admissions
              </span>
              <h4 className="text-base font-bold text-slate-900">2026/2027 Academic Session Admissions Open</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Admissions for the upcoming academic year are now being accepted online. Prospective families are encouraged to submit early.
              </p>
              <Link href="/apply" className="text-xs font-semibold text-indigo-600 hover:underline inline-block pt-1">
                Read application details &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Academic Calendar
              </span>
              <h4 className="text-base font-bold text-slate-900">Term Dates &amp; Assessment Schedule Published</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                The school administration has ratified the termly calendar including continuous assessment windows and holiday schedules.
              </p>
              <Link href="/news" className="text-xs font-semibold text-indigo-600 hover:underline inline-block pt-1">
                View calendar highlights &rarr;
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Portal Services
              </span>
              <h4 className="text-base font-bold text-slate-900">Parent &amp; Student Portal Access Active</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Registered parents can log in securely to inspect fee status, report cards, daily attendance registers, and academic broadsheets.
              </p>
              <Link href="/login" className="text-xs font-semibold text-indigo-600 hover:underline inline-block pt-1">
                Access portal login &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer & Contact Section */}
      <footer id="contact" className="bg-slate-900 text-slate-300 py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12">
          
          <div>
            <div className="flex items-center gap-3 mb-6">
              {school.logo ? (
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-slate-700 bg-white shrink-0 flex items-center justify-center p-1">
                  <Image
                    src={school.logo}
                    alt={`${school.name} Logo`}
                    fill
                    sizes="40px"
                    className="object-contain"
                    unoptimized={true}
                  />
                </div>
              ) : (
                <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              )}
              <h2 className="text-xl font-bold text-white">{school.name}</h2>
            </div>
            <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
              {isDemo 
                ? demoDescription
                : `Unified institutional portal servicing ${preciseTier === "PRIMARY" ? "pupil academic records" : preciseTier === "NURSERY" ? "early childhood care and developmental milestones" : "student academic workspaces"}, staff operations, and online admissions enrollment.`}
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1 mb-6">
              <TenantAuthActions
                initialIsAuthed={isAuthedUser}
                workspaceHref={workspaceHref}
                email={session?.email}
                subdomain={school.subdomain}
                variant="footer"
              />
            </div>
          </div>

          <div className="bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-sm">
            <h3 className="text-base font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-400" />
              <span>Contact &amp; Enquiries</span>
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Campus Address</p>
                  <p className="text-white text-sm font-medium">{schoolAddress}</p>
                </div>
              </li>
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
                    href={`mailto:${session?.email || contactEmail}`} 
                    className="text-white font-medium hover:text-indigo-400 transition-colors text-sm"
                  >
                    {session?.email || contactEmail}
                  </a>
                </div>
              </li>
            </ul>
          </div>
          
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} {school.name}. All rights reserved. Unified Student, Staff &amp; Admissions Portal &bull; Powered by BonaveeICT SchoolERP.</p>
        </div>
      </footer>
    </div>
  );
}
