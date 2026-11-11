/**
 * Canonical Nigerian Educational Curriculum Subject Rosters by Class & Tier
 * Shared across server actions, API routes, and client-side broadsheets.
 */

export const NURSERY_SUBJECTS: readonly string[] = [
  "Numeracy / Cognitive Development",
  "Literacy / Phonics",
  "Rhymes & Poetry",
  "Social Norms / Habits",
  "Sensory Play & Creative Arts",
  "Health Habits",
];

export const PRIMARY_SUBJECTS: readonly string[] = [
  "English Studies",
  "Mathematics",
  "Basic Science & Technology",
  "Social Studies",
  "Civic Education / National Values",
  "Agricultural Science",
  "Home Economics",
  "Cultural & Creative Arts (CCA)",
  "Computer Studies / ICT",
  "Physical & Health Education",
  "Christian Religious Studies",
  "Nigerian History",
];

export const JSS_SUBJECTS: readonly string[] = [
  "English Language",
  "Mathematics",
  "Basic Science",
  "Basic Technology",
  "Social Studies",
  "Civic Education",
  "Agricultural Science",
  "Business Studies",
  "Computer Studies / ICT",
  "Christian Religious Studies",
  "Home Economics",
  "Physical & Health Education",
  "French Language",
  "Cultural & Creative Arts (CCA)",
];

export const SSS_SUBJECTS: readonly string[] = [
  "English Language",
  "General Mathematics",
  "Civic Education",
  "Biology",
  "Chemistry",
  "Physics",
  "Further Mathematics",
  "Agricultural Science",
  "Economics",
  "Government",
  "Literature-in-English",
  "Financial Accounting",
  "Commerce",
  "Data Processing / Marketing",
  "Geography",
  "Christian Religious Studies",
];

export const SECONDARY_SUBJECTS: readonly string[] = SSS_SUBJECTS;

export const HIGHER_ED_COURSES: readonly string[] = [
  "GST 111 - Use of English",
  "GST 112 - Philosophy & Logic",
  "GST 113 - Nigerian Peoples & Culture",
  "GST 211 - Entrepreneurship & Innovation",
  "MTH 101 - Elementary Mathematics",
  "CHM 101 - General Chemistry",
  "PHY 101 - General Physics",
  "COS 101 - Introduction to Computer Science",
];

export function getEducationalStageForClass(
  className: string,
  tierCategory?: string
): "NURSERY" | "PRIMARY" | "JSS" | "SSS" | "TERTIARY" {
  const norm = (className || "").toUpperCase().trim();

  // 1. Junior Secondary Check (JSS 1-3, JS 1-3, Junior, Basic 7-9, Grade 7-9)
  if (
    norm.includes("JSS") ||
    norm.includes("J.S.S") ||
    /\bJS\s*[1-3]\b/.test(norm) ||
    norm.startsWith("JS") ||
    norm.includes("JUNIOR") ||
    norm.includes("BASIC 7") ||
    norm.includes("BASIC 8") ||
    norm.includes("BASIC 9") ||
    norm.includes("GRADE 7") ||
    norm.includes("GRADE 8") ||
    norm.includes("GRADE 9")
  ) {
    return "JSS";
  }

  // 2. Senior Secondary Check (SSS 1-3, SS 1-3, Senior, Grade 10-12)
  if (
    norm.includes("SSS") ||
    norm.includes("S.S.S") ||
    /\bSS\s*[1-3]\b/.test(norm) ||
    norm.startsWith("SS") ||
    norm.includes("SENIOR") ||
    norm.includes("GRADE 10") ||
    norm.includes("GRADE 11") ||
    norm.includes("GRADE 12")
  ) {
    return "SSS";
  }

  // 3. Early Years / Nursery Check
  if (
    norm.includes("NURSERY") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("PRE-SCHOOL") ||
    norm.includes("PRE SCHOOL") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("RECEPTION") ||
    norm.includes("KG")
  ) {
    return "NURSERY";
  }

  // 4. Primary Check
  if (
    norm.includes("PRIMARY") ||
    norm.includes("BASIC") ||
    norm.includes("ELEMENTARY") ||
    norm.includes("GRADE") ||
    /\bP[1-6]\b/.test(norm)
  ) {
    return "PRIMARY";
  }

  // 5. Higher Education / Tertiary
  if (
    norm.includes("LEVEL") ||
    norm.includes("100L") ||
    norm.includes("200L") ||
    norm.includes("300L") ||
    norm.includes("400L") ||
    norm.includes("500L") ||
    norm.includes("ND") ||
    norm.includes("HND") ||
    norm.includes("NCE")
  ) {
    return "TERTIARY";
  }

  // Fallback to tierCategory
  const normTier = (tierCategory || "").toUpperCase();
  if (normTier.includes("NURSERY") || normTier.includes("EARLY")) return "NURSERY";
  if (normTier.includes("PRIMARY") || normTier.includes("BASIC")) return "PRIMARY";
  if (normTier.includes("TERTIARY") || normTier.includes("UNIVERSITY") || normTier.includes("POLYTECHNIC") || normTier.includes("COLLEGE")) return "TERTIARY";
  if (normTier.includes("SECONDARY")) {
    if (norm.includes("SS")) return "SSS";
    return "JSS";
  }

  return "PRIMARY";
}

export function getSubjectsForClassAndTier(
  className: string,
  tierCategory?: string
): string[] {
  const stage = getEducationalStageForClass(className, tierCategory);
  switch (stage) {
    case "NURSERY":
      return [...NURSERY_SUBJECTS];
    case "PRIMARY":
      return [...PRIMARY_SUBJECTS];
    case "JSS":
      return [...JSS_SUBJECTS];
    case "SSS":
      return [...SSS_SUBJECTS];
    case "TERTIARY":
      return [...HIGHER_ED_COURSES];
    default:
      return [...PRIMARY_SUBJECTS];
  }
}

