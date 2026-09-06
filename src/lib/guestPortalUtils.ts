export function generateTierMockData(tierName: string, schoolName: string) {
  const normalizedTier = tierName.toUpperCase();

  if (normalizedTier.includes("DAYCARE") || normalizedTier.includes("NURSERY") || normalizedTier.includes("EARLY CARE")) {
    return {
      heroTitle: `Welcome to ${schoolName} Early Care & Nursery`,
      aboutUs: "A safe, nurturing, and creative environment where toddlers discover milestones through play, early literacy, and comprehensive caregiver attention."
    };
  }
  
  if (normalizedTier.includes("SECONDARY") || normalizedTier.includes("PRIMARY") || normalizedTier.includes("HIGH SCHOOL")) {
    return {
      heroTitle: `Welcome to ${schoolName} Primary & Secondary School`,
      aboutUs: "Fostering academic excellence, moral discipline, and future leaders through well-structured Nigerian curriculum cycles running from Primary 1 up to SS3."
    };
  }

  if (normalizedTier.includes("UNIVERSITY") || normalizedTier.includes("HIGHER ED") || normalizedTier.includes("COLLEGE")) {
    return {
      heroTitle: `Welcome to the Official Portal of ${schoolName}`,
      aboutUs: "A premium institution of higher learning dedicated to global research, academic innovation, and professional competency across engineering, law, and medical faculties."
    };
  }

  // Default fallback
  return {
    heroTitle: `Welcome to ${schoolName}`,
    aboutUs: "Empowering students to achieve academic excellence and personal growth in a supportive and innovative learning environment."
  };
}

export function formatTierLabel(tierName: string): string {
  if (!tierName) return "";
  const up = tierName.toUpperCase();
  if (up === "UNIVERSITY" || up.includes("UNIVERSITY")) return "University";
  if (up === "POLYTECHNIC" || up.includes("POLYTECHNIC")) return "Polytechnic";
  if (up === "COLLEGE_OF_EDUCATION" || up.includes("COLLEGE OF EDUCATION")) return "College of Education";
  if (up === "PRIMARY_SECONDARY" || up.includes("SECONDARY") || up.includes("HIGH SCHOOL") || up.includes("PRIMARY")) return "Primary & Secondary School";
  if (up === "DAYCARE" || up.includes("DAYCARE") || up.includes("NURSERY") || up.includes("EARLY CARE")) return "Nursery & Early Care";
  if (up.includes("HIGHER ED") || up.includes("COLLEGE")) return "Higher Education";
  return tierName;
}

const NURSERY_IMAGES = [
  "https://images.unsplash.com/photo-1544776193-c4d6f0cbf985?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&q=80&w=2000"
];

const PRIMARY_IMAGES = [
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&q=80&w=2000"
];

const SECONDARY_IMAGES = [
  "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=2000"
];

const HIGHER_ED_IMAGES = [
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=2000"
];

export function getHeroImage(tierName: string, customImage?: string): string {
  if (customImage) return customImage;
  
  if (!tierName) return HIGHER_ED_IMAGES[0];
  
  const up = tierName.toUpperCase();
  const pick = (arr: string[]) => arr[tierName.length % arr.length]; // Deterministic pick based on string length

  if (up.includes("DAYCARE") || up.includes("NURSERY") || up.includes("EARLY CARE")) {
    return pick(NURSERY_IMAGES);
  }
  if (up.includes("PRIMARY")) {
    return pick(PRIMARY_IMAGES);
  }
  if (up.includes("SECONDARY") || up.includes("HIGH SCHOOL")) {
    return pick(SECONDARY_IMAGES);
  }
  
  // Default to higher ed images for university, polytechnic, college, etc.
  return pick(HIGHER_ED_IMAGES);
}
