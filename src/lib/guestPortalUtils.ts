export function generateTierMockData(preciseTier: string, schoolName: string) {
  if (preciseTier === "NURSERY" || preciseTier === "CRECHE") {
    return {
      heroTitle: `Welcome to ${schoolName} Creche / Nursery`,
      aboutUs: "A safe, nurturing, and creative environment where toddlers discover milestones through play, early literacy, and comprehensive caregiver attention."
    };
  }
  
  if (preciseTier === "PRIMARY") {
    return {
      heroTitle: `Welcome to ${schoolName} Primary School`,
      aboutUs: "Fostering academic excellence, moral discipline, and future leaders through well-structured Nigerian primary curriculum cycles."
    };
  }

  if (preciseTier === "SECONDARY") {
    return {
      heroTitle: `Welcome to ${schoolName} Secondary School`,
      aboutUs: "Fostering academic excellence, moral discipline, and future leaders through comprehensive secondary education from JSS 1 to SS 3."
    };
  }

  if (preciseTier === "PRIMARY_SECONDARY") {
    return {
      heroTitle: `Welcome to ${schoolName} Primary & Secondary School`,
      aboutUs: "Fostering academic excellence, moral discipline, and future leaders through well-structured Nigerian curriculum cycles running from Primary 1 up to SS3."
    };
  }

  if (preciseTier === "UNIVERSITY" || preciseTier === "POLYTECHNIC" || preciseTier === "COLLEGE_OF_EDUCATION") {
    const titleType = preciseTier === "UNIVERSITY" ? "University" : preciseTier === "POLYTECHNIC" ? "Polytechnic" : "College of Education";
    return {
      heroTitle: `Welcome to the Official Portal of ${schoolName}`,
      aboutUs: `A premium ${titleType.toLowerCase()} dedicated to global research, academic innovation, and professional competency.`
    };
  }

  // Default fallback
  return {
    heroTitle: `Welcome to ${schoolName}`,
    aboutUs: "Empowering students to achieve academic excellence and personal growth in a supportive and innovative learning environment."
  };
}

export function formatTierLabel(preciseTier: string): string {
  if (!preciseTier) return "";
  if (preciseTier === "UNIVERSITY") return "University";
  if (preciseTier === "POLYTECHNIC") return "Polytechnic";
  if (preciseTier === "COLLEGE_OF_EDUCATION") return "College of Education";
  if (preciseTier === "PRIMARY_SECONDARY") return "Primary & Secondary School";
  if (preciseTier === "PRIMARY") return "Primary School";
  if (preciseTier === "SECONDARY") return "Secondary School";
  if (preciseTier === "NURSERY" || preciseTier === "CRECHE") return "Creche / Nursery";
  if (preciseTier === "HIGHER_ED") return "Higher Education";
  return preciseTier;
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

const UNIVERSITY_IMAGES = [
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=2000"
];

const POLYTECHNIC_IMAGES = [
  "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1537432376769-00f5c2f4c8d2?auto=format&fit=crop&q=80&w=2000"
];

const COLLEGE_IMAGES = [
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=2000"
];

export function getHeroImage(preciseTier: string, customImage?: string): string {
  if (customImage) return customImage;
  
  if (!preciseTier) return UNIVERSITY_IMAGES[0];
  
  const pick = (arr: string[]) => arr[preciseTier.length % arr.length];

  if (preciseTier === "NURSERY") {
    return pick(NURSERY_IMAGES);
  }
  if (preciseTier === "PRIMARY" || preciseTier === "PRIMARY_SECONDARY") {
    return pick(PRIMARY_IMAGES);
  }
  if (preciseTier === "SECONDARY") {
    return pick(SECONDARY_IMAGES);
  }
  if (preciseTier === "POLYTECHNIC") {
    return pick(POLYTECHNIC_IMAGES);
  }
  if (preciseTier === "COLLEGE_OF_EDUCATION") {
    return pick(COLLEGE_IMAGES);
  }
  
  // Default to university images
  return pick(UNIVERSITY_IMAGES);
}
