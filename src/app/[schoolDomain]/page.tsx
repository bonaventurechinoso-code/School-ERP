import { basePrisma } from "@/lib/tenant-prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { generateTierMockData, formatTierLabel, getHeroImage } from "@/lib/guestPortalUtils";
import { Building2, Phone, Mail, ArrowRight } from "lucide-react";

export default async function PublicGuestPortalPage({
  params,
}: {
  params: { schoolDomain: string };
}) {
  const school = await basePrisma.school.findUnique({
    where: { subdomain: params.schoolDomain },
    include: {
      academicTiers: true,
      staff: {
        take: 1, // Attempt to get the admin's email for contact
        orderBy: { createdAt: 'asc' }
      }
    }
  });

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

  // Determine Primary Tier for Mock Data
  const primaryTier = school.academicTiers.length > 0 ? school.academicTiers[0].name : "";
  const { heroTitle, aboutUs } = generateTierMockData(primaryTier, school.name);
  
  // Use custom welcome greeting if provided and different from default
  const finalHeroTitle = (school.welcomeGreeting && school.welcomeGreeting !== "Welcome to our institution!") 
    ? school.welcomeGreeting 
    : heroTitle;
  
  const contactEmail = school.staff.length > 0 ? school.staff[0].email : "admissions@school.local";
  const contactPhone = "+234 (0) 800 000 0000"; // Mocked since no native column exists yet
  
  // Resolve tier-specific hero background image
  const heroImageUrl = getHeroImage(primaryTier, (school as any).metadata?.heroImage);

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
            href={`/${school.subdomain}/apply`}
            className="hidden md:inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
          >
            Apply Online <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section - Split Screen Layout */}
      <main className="flex-1">
        <div className="bg-slate-900 text-white relative overflow-hidden">
          {/* Mobile Background Image (absolute & faded) */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-slate-900/90 mix-blend-multiply z-0 md:hidden"></div>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 md:hidden mix-blend-overlay z-0"
            style={{ backgroundImage: `url('${heroImageUrl}')` }}
          ></div>

          <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center">
            {/* Text Content (Left side on desktop) */}
            <div className="w-full md:w-1/2 py-24 md:py-32 pr-0 md:pr-12 text-center md:text-left">
              <h2 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
                {finalHeroTitle}
              </h2>
              <p className="text-lg md:text-xl text-slate-300 mb-10 max-w-2xl leading-relaxed mx-auto md:mx-0">
                {aboutUs}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
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
            
            {/* Image Content (Right side on desktop) */}
            <div className="hidden md:block w-full md:w-1/2 absolute right-0 top-0 bottom-0 h-full">
               {/* Soft gradient blend on the left edge of the image */}
               <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/40 to-transparent z-10"></div>
               <img src={heroImageUrl} alt={`${primaryTier || 'School'} Campus Environment`} className="w-full h-full object-cover" />
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
                  <h4 className="text-2xl font-bold text-slate-800 mb-4 group-hover:text-blue-600 transition-colors">{formatTierLabel(tier.name)}</h4>
                  <p className="text-slate-600 mb-8 flex-1 leading-relaxed">
                    Comprehensive lifecycle management and rigorous academic structuring specifically tailored for the {formatTierLabel(tier.name)} tier.
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
