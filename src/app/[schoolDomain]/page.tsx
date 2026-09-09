import { basePrisma } from "@/lib/tenant-prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateTierMockData, formatTierLabel, getHeroImage } from "@/lib/guestPortalUtils";
import { Building2, Phone, Mail, ArrowRight } from "lucide-react";

export default async function PublicGuestPortalPage({
  params,
}: {
  params: Promise<{ schoolDomain: string }>;
}) {
  const { schoolDomain } = await params;
  let school = null;
  try {
    school = await basePrisma.school.findUnique({
      where: { subdomain: schoolDomain },
      include: {
        academicTiers: true,
        staff: {
          take: 1, // Attempt to get the admin's email for contact
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  } catch (error) {
    console.error("Tenant DB fetch error:", error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Tenant Offline / Under Maintenance</h2>
          <p>We are unable to connect to this tenant&apos;s metadata context at the moment. Please try again later.</p>
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
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-4">{school.name}</h1>
          <p className="text-slate-500">
            This portal is currently offline. Please contact the school administration for more information.
          </p>
        </div>
      </div>
    );
  }

  // Resolve precise tier based on academicTiers for clean nomenclature
  let preciseTier = "UNIVERSITY";
  const schoolNameUpper = school.name.toUpperCase();
  if (school.academicTiers.length > 0) {
    const tierNames = school.academicTiers.map(t => t.name.toUpperCase());
    if (tierNames.some(t => t.includes("UNIVERSITY"))) preciseTier = "UNIVERSITY";
    else if (tierNames.some(t => t.includes("POLYTECHNIC"))) preciseTier = "POLYTECHNIC";
    else if (tierNames.some(t => t.includes("COLLEGE"))) preciseTier = "COLLEGE_OF_EDUCATION";
    else if (tierNames.some(t => t.includes("HIGHER ED"))) preciseTier = "UNIVERSITY";
    else if (tierNames.some(t => t.includes("PRIMARY")) || schoolNameUpper.includes("PRIMARY")) preciseTier = "PRIMARY";
  } else if (schoolNameUpper.includes("PRIMARY")) {
    preciseTier = "PRIMARY";
  }
  // Use preciseTier for clean nomenclature
  const { heroTitle, aboutUs } = generateTierMockData(preciseTier, school.name);
  
  // Use custom welcome greeting if provided and different from default
  const finalHeroTitle = (school.welcomeGreeting && school.welcomeGreeting !== "Welcome to our institution!") 
    ? school.welcomeGreeting 
    : heroTitle;
  
  const contactEmail = school.staff.length > 0 ? school.staff[0].email : "admissions@school.local";
  const contactPhone = "+234 (0) 800 000 0000"; // Mocked since no native column exists yet
  
  // Resolve tier-specific hero background image
  let defaultHeroImage = "/assets/images/university-campus.jpg";
  switch (preciseTier) {
    case "POLYTECHNIC": defaultHeroImage = "/assets/images/polytechnic-workshop.jpg"; break;
    case "COLLEGE_OF_EDUCATION": defaultHeroImage = "/assets/images/college-lecture.jpg"; break;
    case "UNIVERSITY":
    default:
      defaultHeroImage = "/assets/images/university-campus.jpg"; break;
  }
  const heroImageUrl = (school as any).metadata?.customHeroImage || defaultHeroImage;

  // Metadata Layer Extraction (Simulated/Fallback until DB column is added)
  const metadata = {
    admissionsEmail: school.staff.length > 0 ? school.staff[0].email : "admissions@school.local",
    admissionsHotline: "+234 (0) 800 000 0000"
  };
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{school.name}</h1>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Online Admissions Portal</p>
            </div>
          </div>
          <Link 
            href={`/${school.subdomain}/login`}
            className="hidden md:inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Staff Portal <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <div className="relative w-full min-h-[600px] overflow-hidden bg-slate-950 text-white flex items-center">
          {/* Full Background Image */}
          <div className="absolute inset-0 w-full h-full z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1920&q=80" 
              className="w-full h-full object-cover" 
              alt="Graduation Background" 
            />
            <div className="absolute inset-0 bg-slate-950/75 mix-blend-multiply pointer-events-none" />
          </div>

          <div className="max-w-7xl mx-auto px-6 relative z-10 w-full flex flex-col items-center justify-center text-center py-24 md:py-32">
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight text-white drop-shadow-lg">
              {finalHeroTitle}
            </h2>
            <p className="text-lg md:text-xl text-slate-200 mb-10 max-w-2xl leading-relaxed mx-auto drop-shadow-md">
              {aboutUs}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href={`/${school.subdomain}/apply`}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-blue-500/20 transition-all transform hover:-translate-y-1"
              >
                Apply Online / Start New Application
              </Link>
              <a 
                href="#contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-lg transition-all backdrop-blur-sm border border-white/10"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>

        {/* Academic Programs (Tiers) */}
        {school.academicTiers.length > 0 && (
          <div className="max-w-7xl mx-auto px-6 py-24">
            <div className="text-center mb-16">
              <h3 className="text-3xl font-bold text-slate-900 mb-4">Our Academic Programs</h3>
              <p className="text-slate-600 max-w-2xl mx-auto">Explore the diverse educational pathways offered at our institution, designed to foster growth at every stage.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {school.academicTiers.map((tier) => (
                <div key={tier.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group cursor-pointer flex flex-col h-full">
                  <h4 className="text-2xl font-bold text-slate-800 mb-4 group-hover:text-blue-600 transition-colors">
                    {preciseTier === "PRIMARY" ? "Early Years & Primary Education" 
                     : preciseTier === "POLYTECHNIC" ? "National Diploma (ND) & Higher National Diploma (HND) Programs"
                     : "Undergraduate & Postgraduate Studies"}
                  </h4>
                  <p className="text-slate-600 mb-8 flex-1 leading-relaxed">
                    {preciseTier === "PRIMARY" 
                      ? "A foundational lifecycle curriculum tailored to foster basic literacy, numeracy, cognitive development, and active early childhood learning stages." 
                      : preciseTier === "POLYTECHNIC"
                      ? "Hands-on technical and vocational curriculum designed for National Diploma (ND 1 & ND 2) and Higher National Diploma (HND 1 & HND 2) tracks, fostering practical engineering, financial, and professional competency."
                      : "Comprehensive lifecycle management and rigorous academic structuring specifically engineered for degrees, research tracks, and professional campus programs."}
                  </p>
                  <Link 
                    href={`/${school.subdomain}/apply`}
                    className="inline-flex items-center font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Start Admission <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer & Contact Card */}
      <footer id="contact" className="bg-slate-900 text-slate-300 py-16 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12">
          
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white">{school.name}</h2>
            </div>
            <p className="text-sm text-slate-400 max-w-sm mb-6 leading-relaxed">
              Committed to providing world-class education, shaping the minds of tomorrow, and fostering an inclusive academic community.
            </p>
          </div>

          <div className="bg-white/5 p-8 rounded-2xl border border-white/10 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Contact & Enquiries</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Admissions Hotline</p>
                  <a href={`tel:${metadata.admissionsHotline.replace(/[^0-9+]/g, '')}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                    {metadata.admissionsHotline}
                  </a>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Us</p>
                  <a href={`mailto:${metadata.admissionsEmail}`} className="text-white font-medium hover:text-blue-400 transition-colors">
                    {metadata.admissionsEmail}
                  </a>
                </div>
              </li>
            </ul>
          </div>
          
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} {school.name}. All rights reserved. Powered by SchoolERP.</p>
        </div>
      </footer>
    </div>
  );
}
