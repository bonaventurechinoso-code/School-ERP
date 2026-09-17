/**
 * Authentic Nigerian Educational Institutions Staff Role Mappings
 * Dynamically resolved based on the active Academic Tier.
 */

// 1. DAYCARE / NURSERY TIER
export const NURSERY_STAFF_ROLES = [
  "Proprietor / Proprietress",
  "Head Teacher",
  "Nursery Caregiver",
  "Assistant Caregiver",
  "Early Years Educator",
  "Nanny / Cleaner",
  "School Nurse",
  "Admin Officer",
] as const;

// 2. PRIMARY SCHOOL TIER (Basic 1 - 6)
export const PRIMARY_STAFF_ROLES = [
  "Headmaster / Headmistress",
  "Assistant Headmaster",
  "Class Teacher",
  "Subject Teacher",
  "Guidance Counsellor",
  "Bursar / Accountant",
  "Administrative Secretary",
  "Store Keeper / Inventory Officer",
] as const;

// 3. SECONDARY SCHOOL TIER (Junior & Senior Secondary)
export const SECONDARY_STAFF_ROLES = [
  "Principal",
  "Vice Principal (Academic)",
  "Vice Principal (Administration)",
  "Form Teacher",
  "Subject Teacher",
  "Dean of Studies",
  "Exam Officer",
  "School Bursar",
  "Librarian",
  "Lab Attendant",
  "Guidance Counsellor",
] as const;

// 4. UNIVERSITIES / TERTIARY TIER (University, Polytechnic, COE)
export const TERTIARY_ACADEMIC_STAFF_ROLES = [
  "Vice Chancellor / Rector / Provost",
  "Dean of Faculty",
  "Head of Department (HOD)",
  "Professor",
  "Associate Professor / Reader",
  "Senior Lecturer",
  "Lecturer I",
  "Lecturer II",
  "Assistant Lecturer",
  "Graduate Assistant",
] as const;

export const TERTIARY_NON_ACADEMIC_STAFF_ROLES = [
  "Registrar",
  "Bursar",
  "University Librarian",
  "Faculty Officer",
  "Administrative Officer",
  "Lab Technologist",
] as const;

export const TERTIARY_ALL_STAFF_ROLES = [
  ...TERTIARY_ACADEMIC_STAFF_ROLES,
  ...TERTIARY_NON_ACADEMIC_STAFF_ROLES,
] as const;

export type StaffTierCategory = "NURSERY" | "PRIMARY" | "SECONDARY" | "TERTIARY";

export function resolveStaffTierCategory(tierInput?: string | null): StaffTierCategory {
  if (!tierInput) return "PRIMARY";
  const normalized = tierInput.toUpperCase().trim();

  if (
    normalized.includes("NURSERY") ||
    normalized.includes("DAYCARE") ||
    normalized.includes("PRE-SCHOOL") ||
    normalized.includes("CRECHE") ||
    normalized.includes("CRÈCHE") ||
    normalized.includes("KINDERGARTEN") ||
    normalized.includes("EARLY")
  ) {
    return "NURSERY";
  }

  if (
    normalized.includes("COLLEGE OF EDUCATION") ||
    normalized.includes("POLYTECHNIC") ||
    normalized.includes("UNIVERSITY") ||
    normalized.includes("TERTIARY") ||
    normalized.includes("HIGHER") ||
    normalized.includes("COLLEGE") ||
    normalized === "COE" ||
    normalized === "NCE" ||
    normalized === "ND" ||
    normalized === "HND" ||
    normalized === "UNI"
  ) {
    return "TERTIARY";
  }

  if (
    normalized.includes("SECONDARY") ||
    normalized.includes("HIGH SCHOOL") ||
    normalized.includes("JSS") ||
    normalized.includes("SSS") ||
    normalized.includes("SS")
  ) {
    return "SECONDARY";
  }

  return "PRIMARY";
}

export function getRolesForTier(category: StaffTierCategory): readonly string[] {
  switch (category) {
    case "NURSERY":
      return NURSERY_STAFF_ROLES;
    case "SECONDARY":
      return SECONDARY_STAFF_ROLES;
    case "TERTIARY":
      return TERTIARY_ALL_STAFF_ROLES;
    case "PRIMARY":
    default:
      return PRIMARY_STAFF_ROLES;
  }
}

export function getDefaultRoleForTier(category: StaffTierCategory): string {
  switch (category) {
    case "NURSERY":
      return "Nursery Caregiver";
    case "SECONDARY":
      return "Subject Teacher";
    case "TERTIARY":
      return "Lecturer I";
    case "PRIMARY":
    default:
      return "Class Teacher";
  }
}

export function getStaffTierBadgeLabel(category: StaffTierCategory): string {
  switch (category) {
    case "NURSERY":
      return "Daycare / Nursery Tier";
    case "SECONDARY":
      return "Secondary School Tier";
    case "TERTIARY":
      return "Tertiary / Higher Ed Tier";
    case "PRIMARY":
    default:
      return "Primary School Tier";
  }
}

/**
 * Dynamic Staff Role Presentation Wrapper
 * Safely maps core system roles to appropriate educational terminology based on the active tier,
 * preventing tertiary titles (e.g. Lecturer, Professor) from bleeding into K-12 or Nursery environments.
 */
export function formatStaffRoleByTier(role: string, category: StaffTierCategory = "PRIMARY"): string {
  if (!role) return "Staff Member";
  const norm = role.toUpperCase().trim().replace(/[\s-]+/g, "_");

  if (category === "NURSERY") {
    if (norm.includes("PROFESSOR") || norm.includes("READER")) return "Early Educator";
    if (norm.includes("LECTURER") || norm.includes("FACULTY")) return "Caregiver";
    if (norm.includes("TEACHER")) return "Early Educator";
    if (norm.includes("NANNY") || norm.includes("CLEANER")) return "Nanny";
    if (norm.includes("CAREGIVER")) return "Caregiver";
    if (norm.includes("HEADMASTER") || norm.includes("PRINCIPAL") || norm.includes("PROVOST") || norm.includes("DEAN")) {
      return "Head Teacher";
    }
  } else if (category === "PRIMARY") {
    if (norm.includes("PROFESSOR") || norm.includes("READER") || norm.includes("LECTURER") || norm.includes("FACULTY")) {
      return "Class Teacher";
    }
    if (norm.includes("PRINCIPAL") || norm.includes("PROVOST") || norm.includes("DEAN") || norm.includes("RECTOR") || norm.includes("CHANCELLOR")) {
      return "Headmaster / Headmistress";
    }
    if (norm.includes("CAREGIVER") || norm.includes("NANNY")) {
      return "Class Assistant";
    }
  } else if (category === "SECONDARY") {
    if (norm.includes("PROFESSOR") || norm.includes("READER") || norm.includes("LECTURER") || norm.includes("FACULTY")) {
      return "Subject Teacher";
    }
    if (norm.includes("HEADMASTER") || norm.includes("PROVOST") || norm.includes("RECTOR") || norm.includes("CHANCELLOR")) {
      return "Principal";
    }
    if (norm.includes("DEAN")) {
      return "Dean of Studies";
    }
    if (norm.includes("CAREGIVER") || norm.includes("NANNY")) {
      return "Lab Attendant";
    }
  } else if (category === "TERTIARY") {
    // Retain and polish tertiary academic roles
    if (norm === "PROFESSOR") return "Professor";
    if (norm.includes("ASSOCIATE_PROFESSOR") || norm.includes("READER")) return "Associate Professor / Reader";
    if (norm.includes("SENIOR_LECTURER")) return "Senior Lecturer";
    if (norm === "LECTURER_I" || norm === "LECTURER_1") return "Lecturer I";
    if (norm === "LECTURER_II" || norm === "LECTURER_2") return "Lecturer II";
    if (norm.includes("ASSISTANT_LECTURER")) return "Assistant Lecturer";
    if (norm.includes("GRADUATE_ASSISTANT")) return "Graduate Assistant";
    if (norm === "LECTURER") return "Lecturer";
  }

  // Normalize snake_case or SCREAMING_SNAKE to Title Case
  if (norm.includes("_")) {
    return role
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return role;
}

