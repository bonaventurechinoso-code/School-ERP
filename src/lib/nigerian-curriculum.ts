/**
 * Nigerian Educational Curriculum Standards (NERDC / UBEC)
 * Authoritative single source of truth for Class-to-Subject mappings across:
 * - Creche / Early Years (Developmental Areas & Activities)
 * - Nursery & Kindergarten (Foundational Literacy, Numeracy & Etiquette)
 * - Primary School (Primary 1 to Primary 6 - Lower & Middle Basic)
 * - Secondary School (JSS 1 to SSS 3 - Upper Basic & Senior Secondary)
 */

// 1. CRECHE / DAYCARE (0 - 2 Years)
export const CRECHE_SUBJECTS = [
  "Sensory & Texture Play",
  "Language & Babbling Stimulation",
  "Fine Motor & Grasping Activities",
  "Story Time & Picture Books",
  "Rhymes & Music",
  "Outdoor Motor Play",
  "Feeding & Nutrition Routine",
  "Nap & Resting Habits",
] as const;

// 2. NURSERY & KINDERGARTEN (2 - 5 Years: Nursery 1, Nursery 2, KG 1, KG 2)
export const NURSERY_SUBJECTS = [
  "Literacy & Phonics",
  "Numeracy & Number Readiness",
  "Basic Science & Nature Study",
  "Rhymes, Songs & Drama",
  "Moral Habits & Civic Etiquette",
  "Fine & Gross Motor Skills",
  "Creative Arts, Crafts & Coloring",
  "Health Habits & Personal Hygiene",
] as const;

// 3. LOWER PRIMARY (Primary 1, Primary 2, Primary 3)
export const LOWER_PRIMARY_SUBJECTS = [
  "English Studies",
  "Mathematics",
  "Basic Science & Technology",
  "Social Studies",
  "Civic Education",
  "Cultural & Creative Arts (CCA)",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "Physical & Health Education (PHE)",
  "Agricultural Science",
  "Home Economics",
  "Computer Studies / ICT",
  "Nigerian Language (Yoruba/Igbo/Hausa)",
] as const;

// 4. UPPER PRIMARY (Primary 4, Primary 5, Primary 6)
export const UPPER_PRIMARY_SUBJECTS = [
  "English Studies",
  "Mathematics",
  "Basic Science & Technology",
  "Social Studies",
  "Civic Education",
  "Cultural & Creative Arts (CCA)",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "Physical & Health Education (PHE)",
  "Agricultural Science",
  "Home Economics",
  "Computer Studies / ICT",
  "Nigerian Language (Yoruba/Igbo/Hausa)",
  "French Language",
] as const;

// 5. JUNIOR SECONDARY (JSS 1, JSS 2, JSS 3)
export const JUNIOR_SECONDARY_SUBJECTS = [
  "English Studies",
  "Mathematics",
  "Basic Science",
  "Basic Technology",
  "Social Studies",
  "Civic Education",
  "Cultural & Creative Arts (CCA)",
  "Christian Religious Studies (CRS)",
  "Islamic Religious Studies (IRS)",
  "Physical & Health Education (PHE)",
  "Agricultural Science",
  "Home Economics",
  "Business Studies",
  "Computer Studies / ICT",
  "French Language",
  "Nigerian Language",
] as const;

// 6. SENIOR SECONDARY (SSS 1, SSS 2, SSS 3)
export const SENIOR_SECONDARY_SUBJECTS = [
  "English Language",
  "General Mathematics",
  "Civic Education",
  "Data Processing / Computer Studies",
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
  "Christian Religious Studies",
  "Islamic Studies",
  "Geography",
] as const;

export function isLowerPrimary(className: string = ""): boolean {
  const norm = className.toUpperCase().trim();
  return (
    norm.includes("PRIMARY 1") ||
    norm.includes("PRIMARY 2") ||
    norm.includes("PRIMARY 3") ||
    norm.includes("PRY 1") ||
    norm.includes("PRY 2") ||
    norm.includes("PRY 3") ||
    norm === "P1" ||
    norm === "P2" ||
    norm === "P3"
  );
}

export function isUpperPrimary(className: string = ""): boolean {
  const norm = className.toUpperCase().trim();
  return (
    norm.includes("PRIMARY 4") ||
    norm.includes("PRIMARY 5") ||
    norm.includes("PRIMARY 6") ||
    norm.includes("PRY 4") ||
    norm.includes("PRY 5") ||
    norm.includes("PRY 6") ||
    norm === "P4" ||
    norm === "P5" ||
    norm === "P6"
  );
}

export function isPrimaryClass(className: string = ""): boolean {
  const norm = className.toUpperCase().trim();
  return (
    isLowerPrimary(className) ||
    isUpperPrimary(className) ||
    norm.includes("PRIMARY") ||
    norm.includes("PRY")
  );
}

export function isNurseryClass(className: string = ""): boolean {
  const norm = className.toUpperCase().trim();
  return (
    norm.includes("NURSERY") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("KG") ||
    norm.includes("RECEPTION")
  );
}

export function isCrecheClass(className: string = ""): boolean {
  const norm = className.toUpperCase().trim();
  return (
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("TODDLER") ||
    norm.includes("INFANT") ||
    norm.includes("DAYCARE")
  );
}

export function isJuniorSecondary(className: string = ""): boolean {
  const norm = className.toUpperCase().trim();
  return (
    norm.includes("JSS") ||
    norm.includes("JS 1") ||
    norm.includes("JS 2") ||
    norm.includes("JS 3") ||
    norm.includes("JUNIOR")
  );
}

export function isSeniorSecondary(className: string = ""): boolean {
  const norm = className.toUpperCase().trim();
  return (
    norm.includes("SSS") ||
    norm.includes("SS 1") ||
    norm.includes("SS 2") ||
    norm.includes("SS 3") ||
    norm.includes("SENIOR")
  );
}

/**
 * Returns the exact list of standard subjects for any Nigerian classroom.
 */
export function getStandardSubjectsForClass(
  className: string = "",
  tierCategory?: string
): string[] {
  const norm = className.toUpperCase().trim();
  const tier = (tierCategory || "").toUpperCase().trim();

  if (isCrecheClass(norm) || tier === "CRECHE") {
    return [...CRECHE_SUBJECTS];
  }

  if (isNurseryClass(norm) || tier === "NURSERY") {
    return [...NURSERY_SUBJECTS];
  }

  if (isLowerPrimary(norm)) {
    return [...LOWER_PRIMARY_SUBJECTS];
  }

  if (isUpperPrimary(norm)) {
    return [...UPPER_PRIMARY_SUBJECTS];
  }

  if (norm.includes("PRIMARY") || norm.includes("PRY") || tier === "PRIMARY") {
    return [...UPPER_PRIMARY_SUBJECTS];
  }

  if (isJuniorSecondary(norm)) {
    return [...JUNIOR_SECONDARY_SUBJECTS];
  }

  if (isSeniorSecondary(norm) || tier === "SECONDARY") {
    return [...SENIOR_SECONDARY_SUBJECTS];
  }

  return [...UPPER_PRIMARY_SUBJECTS];
}

/**
 * Normalizes subject names to find equivalent subjects in database
 * e.g. "Mathematics" <-> "General Mathematics"
 *      "English Language" <-> "English Studies"
 *      "Computer Studies" <-> "Computer Studies / ICT"
 */
export function matchSubjectAlias(name1: string, name2: string): boolean {
  if (!name1 || !name2) return false;
  const a = name1.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const b = name2.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  if (a === b) return true;

  // Math aliases
  const isMathA = a === "mathematics" || a === "generalmathematics" || a === "maths";
  const isMathB = b === "mathematics" || b === "generalmathematics" || b === "maths";
  if (isMathA && isMathB) return true;

  // English aliases
  const isEngA = a === "english" || a === "englishstudies" || a === "englishlanguage";
  const isEngB = b === "english" || b === "englishstudies" || b === "englishlanguage";
  if (isEngA && isEngB) return true;

  // Science aliases
  const isSciA = a.includes("basicscience");
  const isSciB = b.includes("basicscience");
  if (isSciA && isSciB) return true;

  // ICT aliases
  const isIctA = a.includes("ict") || a.includes("computer");
  const isIctB = b.includes("ict") || b.includes("computer");
  if (isIctA && isIctB) return true;

  return false;
}
