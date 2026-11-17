/**
 * Authentic Nigerian Educational Institutions Staff Role Mappings
 * Dynamically resolved across all 5 Academic Tiers:
 * 1. CRECHE / DAYCARE
 * 2. NURSERY / KINDERGARTEN
 * 3. PRIMARY SCHOOL
 * 4. SECONDARY SCHOOL
 * 5. TERTIARY (UNIVERSITY / POLYTECHNIC / COLLEGE)
 */

export type StaffTierCategory = "CRECHE" | "NURSERY" | "PRIMARY" | "SECONDARY" | "TERTIARY";

// ============================================================================
// 1. TIER TERMINOLOGY MAP
// ============================================================================
export interface TierTerminology {
  tierName: string;
  institutionName: string;
  learnerTitle: string;        // Child / Pupil / Student
  groupTitle: string;          // Playgroup / Class / Class / Arm / Level & Programme
  teachingUnit: string;        // Activity / Learning Area / Subject / Course
  teacherTitle: string;        // Caregiver / Nursery Teacher / Class Teacher / Subject Teacher / Form Tutor / Lecturer
  academicPeriod: "Term" | "Semester";
  hasHod: boolean;
  hodTitle?: string;
  trcnRequirement: "OPTIONAL" | "REQUIRED" | "OPTIONAL_DOCUMENTED";
}

export const TIER_TERMINOLOGY: Record<StaffTierCategory, TierTerminology> = {
  CRECHE: {
    tierName: "Creche / Daycare",
    institutionName: "Creche / Daycare Centre",
    learnerTitle: "Child / Toddler",
    groupTitle: "Playgroup / Class",
    teachingUnit: "Activity / Play Area",
    teacherTitle: "Caregiver / Minder / Early Years Caregiver",
    academicPeriod: "Term",
    hasHod: false,
    trcnRequirement: "OPTIONAL",
  },
  NURSERY: {
    tierName: "Nursery School",
    institutionName: "Nursery School",
    learnerTitle: "Pupil",
    groupTitle: "Class",
    teachingUnit: "Learning Area",
    teacherTitle: "Nursery Teacher",
    academicPeriod: "Term",
    hasHod: false,
    trcnRequirement: "OPTIONAL",
  },
  PRIMARY: {
    tierName: "Primary School",
    institutionName: "Primary School",
    learnerTitle: "Pupil",
    groupTitle: "Class",
    teachingUnit: "Subject",
    teacherTitle: "Class Teacher / Subject Teacher",
    academicPeriod: "Term",
    hasHod: false,
    trcnRequirement: "REQUIRED",
  },
  SECONDARY: {
    tierName: "Secondary School",
    institutionName: "Secondary School",
    learnerTitle: "Student",
    groupTitle: "Class / Arm",
    teachingUnit: "Subject",
    teacherTitle: "Subject Teacher / Form Tutor",
    academicPeriod: "Term",
    hasHod: true,
    hodTitle: "Head of Department (HOD)",
    trcnRequirement: "REQUIRED",
  },
  TERTIARY: {
    tierName: "Tertiary Institution",
    institutionName: "Polytechnic / University / College",
    learnerTitle: "Student",
    groupTitle: "Level / Programme",
    teachingUnit: "Course",
    teacherTitle: "Lecturer / Senior Lecturer / Professor",
    academicPeriod: "Semester",
    hasHod: true,
    hodTitle: "Head of Department (HOD)",
    trcnRequirement: "OPTIONAL_DOCUMENTED",
  },
};

// ============================================================================
// 2. ROLE MATRICES PER TIER
// ============================================================================

export const CRECHE_STAFF_ROLES = [
  "Caregiver",
  "Assistant Caregiver",
  "Creche Supervisor",
  "Nurse / First Aider",
  "Cleaner / Support",
  "Admin / Receptionist",
] as const;

export const NURSERY_STAFF_ROLES = [
  "Nursery Teacher",
  "Assistant Teacher",
  "Nursery Supervisor / Head of Nursery",
  "Caregiver",
  "Admin",
  "Support Staff",
] as const;

export const PRIMARY_STAFF_ROLES = [
  "Class Teacher",
  "Subject Teacher",
  "Head Teacher",
  "Assistant Head Teacher",
  "Bursar / Accountant",
  "Admin Officer",
  "Librarian",
  "Cleaner / Security / Driver",
] as const;

export const SECONDARY_STAFF_ROLES = [
  "Subject Teacher",
  "Form Tutor (Class Teacher)",
  "Head of Department (HOD)",
  "Vice Principal (Academics)",
  "Vice Principal (Admin)",
  "Principal",
  "Bursar",
  "Librarian",
  "Lab Technologist",
  "Admin",
  "Support Staff",
] as const;

export const SECONDARY_HOD_DEPARTMENTS = [
  "Sciences",
  "Arts / Humanities",
  "Commercial",
  "Languages",
  "Vocational / Technical",
] as const;

export const TERTIARY_UNIVERSITY_ACADEMIC_ROLES = [
  "Graduate Assistant",
  "Assistant Lecturer",
  "Lecturer II",
  "Lecturer I",
  "Senior Lecturer",
  "Reader / Associate Professor",
  "Professor",
] as const;

export const TERTIARY_POLYTECHNIC_ACADEMIC_ROLES = [
  "Assistant Lecturer",
  "Lecturer III",
  "Lecturer II",
  "Lecturer I",
  "Senior Lecturer",
  "Principal Lecturer",
  "Chief Lecturer",
] as const;

export const TERTIARY_ADMIN_ROLES = [
  "Head of Department (HOD)",
  "Dean",
  "Provost / Rector / Vice-Chancellor",
  "Registrar / Bursar (Non-Academic)",
  "Lab Technologist",
  "Admin Officer",
  "Support Staff",
] as const;

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
  "Principal Lecturer",
  "Chief Lecturer",
] as const;

export const TERTIARY_NON_ACADEMIC_STAFF_ROLES = [
  "Registrar",
  "Bursar",
  "University Librarian",
  "Faculty Officer",
  "Administrative Officer",
  "Lab Technologist",
  "Support Staff",
] as const;

export const TERTIARY_ALL_STAFF_ROLES = [
  "Graduate Assistant",
  "Assistant Lecturer",
  "Lecturer III",
  "Lecturer II",
  "Lecturer I",
  "Senior Lecturer",
  "Principal Lecturer",
  "Chief Lecturer",
  "Reader / Associate Professor",
  "Professor",
  "Head of Department (HOD)",
  "Dean",
  "Provost / Rector / Vice-Chancellor",
  "Registrar / Bursar (Non-Academic)",
  "Lab Technologist",
  "Admin Officer",
  "Support Staff",
] as const;

/**
 * Format staff role title safely according to tier
 */
export function formatStaffRoleByTier(role: string, category: StaffTierCategory = "PRIMARY"): string {
  if (!role) return "Staff Member";
  const norm = role.toUpperCase().trim().replace(/[\s-]+/g, "_");

  if (category === "CRECHE") {
    if (norm.includes("CARE") || norm.includes("NANNY") || norm.includes("TEACHER") || norm.includes("LECTURER")) return "Caregiver";
    if (norm.includes("HEAD") || norm.includes("PRINCIPAL") || norm.includes("DEAN") || norm.includes("SUPERVISOR")) return "Creche Supervisor";
    if (norm.includes("NURSE")) return "Nurse / First Aider";
    return "Support Staff";
  } else if (category === "NURSERY") {
    if (norm.includes("PROFESSOR") || norm.includes("READER") || norm.includes("LECTURER")) return "Nursery Teacher";
    if (norm.includes("TEACHER")) return "Nursery Teacher";
    if (norm.includes("NANNY") || norm.includes("CLEANER")) return "Support Staff";
    if (norm.includes("CAREGIVER")) return "Caregiver";
    if (norm.includes("HEAD") || norm.includes("PRINCIPAL") || norm.includes("PROVOST") || norm.includes("DEAN")) return "Head of Nursery";
  } else if (category === "PRIMARY") {
    if (norm.includes("PROFESSOR") || norm.includes("READER") || norm.includes("LECTURER")) return "Class Teacher";
    if (norm.includes("HEADMASTER") || norm.includes("HEAD") || norm.includes("PRINCIPAL") || norm.includes("PROVOST") || norm.includes("DEAN")) return "Head Teacher";
    if (norm.includes("CAREGIVER") || norm.includes("NANNY")) return "Class Assistant";
  } else if (category === "SECONDARY") {
    if (norm.includes("PROFESSOR") || norm.includes("READER") || norm.includes("LECTURER")) return "Subject Teacher";
    if (norm.includes("HEADMASTER") || norm.includes("PROVOST") || norm.includes("RECTOR") || norm.includes("CHANCELLOR")) return "Principal";
    if (norm.includes("DEAN")) return "Vice Principal";
  } else if (category === "TERTIARY") {
    if (norm === "PROFESSOR") return "Professor";
    if (norm.includes("ASSOCIATE_PROFESSOR") || norm.includes("READER")) return "Associate Professor / Reader";
    if (norm.includes("SENIOR_LECTURER")) return "Senior Lecturer";
    if (norm === "LECTURER_I" || norm === "LECTURER_1") return "Lecturer I";
    if (norm === "LECTURER_II" || norm === "LECTURER_2") return "Lecturer II";
    if (norm.includes("ASSISTANT_LECTURER")) return "Assistant Lecturer";
    if (norm.includes("GRADUATE_ASSISTANT")) return "Graduate Assistant";
    if (norm === "LECTURER") return "Lecturer";
  }

  if (norm.includes("_")) {
    return role.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  }
  return role;
}

// ============================================================================
// 3. TIER RESOLUTION HELPER
// ============================================================================
export function resolveStaffTierCategory(tierInput?: string | null): StaffTierCategory {
  if (!tierInput) return "PRIMARY";
  const normalized = tierInput.toUpperCase().trim();

  // Strict Creche check (First priority)
  if (
    normalized.includes("CRECHE") ||
    normalized.includes("CRÈCHE") ||
    normalized.includes("DAYCARE") ||
    normalized.includes("TODDLER") ||
    normalized.includes("INFANT") ||
    normalized.includes("PLAYGROUP")
  ) {
    return "CRECHE";
  }

  // Nursery check
  if (
    normalized.includes("NURSERY") ||
    normalized.includes("KINDERGARTEN") ||
    normalized.includes("PRE-SCHOOL") ||
    normalized.includes("PRE SCHOOL") ||
    normalized.includes("KG") ||
    normalized.includes("EARLY")
  ) {
    return "NURSERY";
  }

  // Tertiary check
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

  // Secondary check
  if (
    normalized.includes("SECONDARY") ||
    normalized.includes("HIGH SCHOOL") ||
    normalized.includes("JSS") ||
    normalized.includes("SSS") ||
    normalized.includes("SS ") ||
    normalized === "SS" ||
    normalized.includes("GRADE 7") ||
    normalized.includes("GRADE 8") ||
    normalized.includes("GRADE 9") ||
    normalized.includes("GRADE 10") ||
    normalized.includes("GRADE 11") ||
    normalized.includes("GRADE 12")
  ) {
    return "SECONDARY";
  }

  return "PRIMARY";
}

// ============================================================================
// 4. ROLES & DEFAULTS PER TIER
// ============================================================================
export function getRolesForTier(category: StaffTierCategory): readonly string[] {
  switch (category) {
    case "CRECHE":
      return CRECHE_STAFF_ROLES;
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
    case "CRECHE":
      return "Caregiver";
    case "NURSERY":
      return "Nursery Teacher";
    case "SECONDARY":
      return "Subject Teacher";
    case "TERTIARY":
      return "Lecturer II";
    case "PRIMARY":
    default:
      return "Class Teacher";
  }
}

export function getStaffTierBadgeLabel(category: StaffTierCategory): string {
  switch (category) {
    case "CRECHE":
      return "Creche / Daycare Tier";
    case "NURSERY":
      return "Nursery School Tier";
    case "SECONDARY":
      return "Secondary School Tier";
    case "TERTIARY":
      return "Tertiary / Higher Ed Tier";
    case "PRIMARY":
    default:
      return "Primary School Tier";
  }
}

// ============================================================================
// 5. NON-TEACHING ROLE RULE FOR ALL TIERS
// ============================================================================
export function isNonTeachingRole(role: string): boolean {
  if (!role) return false;
  const norm = role.toLowerCase().trim();
  return (
    norm.includes("bursar") ||
    norm.includes("accountant") ||
    norm.includes("finance") ||
    norm.includes("admin") ||
    norm.includes("cleaner") ||
    norm.includes("security") ||
    norm.includes("driver") ||
    norm.includes("librarian") ||
    norm.includes("nurse") ||
    norm.includes("first aider") ||
    norm.includes("receptionist") ||
    norm.includes("support staff") ||
    norm.includes("registrar") ||
    norm.includes("provost") ||
    norm.includes("rector") ||
    norm.includes("vice-chancellor") ||
    norm.includes("vice chancellor")
  );
}

// ============================================================================
// 6. TIER-AWARE QUALIFICATIONS
// ============================================================================
export const CRECHE_QUALIFICATIONS = [
  "SSCE / WAEC / NECO",
  "Diploma in Early Childhood Education",
  "Childcare / First Aid Certificate",
  "N.C.E (Early Childhood Education)",
  "B.Ed (Early Childhood Education)",
  "Other Relevant Professional Certificate",
] as const;

export const NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS = [
  "N.C.E (Nigeria Certificate in Education)",
  "B.Ed (Bachelor of Education)",
  "B.Sc (Ed) / B.A (Ed)",
  "B.Sc / B.A / B.Tech + PGDE",
  "B.Sc / B.A (Non-Education)",
  "H.N.D + PGDE",
  "M.Ed (Master of Education)",
  "M.Sc / M.A",
  "Ph.D (Doctor of Philosophy)",
] as const;

export const TERTIARY_QUALIFICATIONS = [
  "B.Sc / B.A / B.Eng / B.Tech (First Class / 2:1)",
  "H.N.D (Higher National Diploma)",
  "M.Sc / M.A / M.Eng / M.Tech",
  "M.Phil",
  "Ph.D (Doctor of Philosophy)",
  "Fellowship / Professional Doctorate",
] as const;

export function getQualificationsForTier(category: StaffTierCategory): readonly string[] {
  switch (category) {
    case "CRECHE":
      return CRECHE_QUALIFICATIONS;
    case "TERTIARY":
      return TERTIARY_QUALIFICATIONS;
    case "NURSERY":
    case "PRIMARY":
    case "SECONDARY":
    default:
      return NURSERY_PRIMARY_SECONDARY_QUALIFICATIONS;
  }
}

// ============================================================================
// 7. TIER-AWARE PAY GRADES
// ============================================================================
export const GENERAL_GL_PAY_GRADES = [
  "GL 01", "GL 02", "GL 03", "GL 04", "GL 05",
  "GL 06", "GL 07", "GL 08", "GL 09", "GL 10",
  "GL 12", "GL 13", "GL 14", "GL 15", "GL 16", "GL 17",
  "Custom / School Internal Scale",
  "Not Applicable",
] as const;

export const TERTIARY_UNIVERSITY_CONUASS = [
  "CONUASS 01 (Graduate Assistant)",
  "CONUASS 02 (Assistant Lecturer)",
  "CONUASS 03 (Lecturer II)",
  "CONUASS 04 (Lecturer I)",
  "CONUASS 05 (Senior Lecturer)",
  "CONUASS 06 (Associate Professor / Reader)",
  "CONUASS 07 (Professor)",
  "Custom / School Internal Scale",
  "Not Applicable",
] as const;

export const TERTIARY_POLYTECHNIC_CONPCASS = [
  "CONPCASS 01", "CONPCASS 02", "CONPCASS 03", "CONPCASS 04",
  "CONPCASS 05", "CONPCASS 06", "CONPCASS 07", "CONPCASS 08", "CONPCASS 09",
  "Custom / School Internal Scale",
  "Not Applicable",
] as const;

export const TERTIARY_CONTISS = [
  "CONTISS 01", "CONTISS 02", "CONTISS 03", "CONTISS 04", "CONTISS 05",
  "CONTISS 06", "CONTISS 07", "CONTISS 08", "CONTISS 09", "CONTISS 10",
  "CONTISS 11", "CONTISS 12", "CONTISS 13", "CONTISS 14", "CONTISS 15",
  "Custom / School Internal Scale",
  "Not Applicable",
] as const;

export function getPayGradesForTier(category: StaffTierCategory, isPolytechnic = false, isNonAcademic = false): readonly string[] {
  if (category === "TERTIARY") {
    if (isNonAcademic) return TERTIARY_CONTISS;
    if (isPolytechnic) return TERTIARY_POLYTECHNIC_CONPCASS;
    return TERTIARY_UNIVERSITY_CONUASS;
  }
  return GENERAL_GL_PAY_GRADES;
}

// ============================================================================
// 8. ROLE PERMISSIONS SUMMARY
// ============================================================================
export function getRolePermissionSummary(role: string, category: StaffTierCategory): string {
  const norm = role.toLowerCase().trim();

  if (category === "CRECHE") {
    if (norm.includes("caregiver")) {
      return "Caregiver: Can record child daily attendance, daily activities, feeding, naps, and developmental observations for assigned playgroup.";
    }
    if (norm.includes("supervisor")) {
      return "Supervisor: Can supervise all playgroups, oversee caregivers, monitor attendance and child safety registers.";
    }
    if (norm.includes("nurse") || norm.includes("first aider")) {
      return "Nurse / First Aider: Can access child medical records, log first aid incidents, and update health cards.";
    }
    return "Support / Admin: Can access facilities, visitor logs, and administrative communications.";
  }

  if (category === "NURSERY") {
    if (norm.includes("teacher")) {
      return "Nursery Teacher: Can log attendance, record learning area observations, evaluate motor and cognitive milestones for assigned pupils.";
    }
    if (norm.includes("supervisor") || norm.includes("head")) {
      return "Head of Nursery: Full oversight of all nursery classes, curriculum plans, teacher remarks, and termly early-years evaluations.";
    }
    return "Staff: Basic attendance and general duty register access.";
  }

  if (category === "PRIMARY") {
    if (norm.includes("class teacher")) {
      return "Class Teacher: Can view own assigned class, record daily attendance, enter Continuous Assessment (CA) and exam scores, and write terminal remarks. Cannot view payroll or school finances.";
    }
    if (norm.includes("subject teacher")) {
      return "Subject Teacher: Can enter CA and exam scores for assigned subjects across designated classes. Cannot view other subjects or financial modules.";
    }
    if (norm.includes("head teacher") || norm.includes("headmaster") || norm.includes("assistant head")) {
      return "Head Teacher: Complete academic oversight across all primary classes, report card approvals, teacher supervision, and academic broadsheets.";
    }
    if (norm.includes("bursar") || norm.includes("accountant")) {
      return "Bursar / Accountant: Manages school fees, payroll vouchers, receipts, and ledger transactions. Cannot modify student academic grades.";
    }
    return "Non-Teaching Staff: Can clock in attendance, view personnel notices, and access staff directory.";
  }

  if (category === "SECONDARY") {
    if (norm.includes("form tutor") || norm.includes("form teacher")) {
      return "Form Tutor: Assigned to specific class/arm (e.g. JSS 2A). Manages class attendance, conducts terminal broadsheet reviews, writes principal recommendations. Cannot alter other classes.";
    }
    if (norm.includes("subject teacher")) {
      return "Subject Teacher: Manages CA1 (20), CA2 (20), and Exam (60) score entry for assigned subjects across designated arms. Generates subject rankings.";
    }
    if (norm.includes("hod") || norm.includes("head of department")) {
      return "Head of Department (HOD): Supervises subject teachers in assigned department(s), reviews lesson notes, approves scheme of work, verifies exam question standards, and countersigns CA broadsheets.";
    }
    if (norm.includes("principal") || norm.includes("vice principal")) {
      return "Principal / Vice Principal: Executive academic administration, broadsheet lock, official transcript signing, termly results publication.";
    }
    if (norm.includes("bursar")) {
      return "Bursar: Tuition tracking, bank payment verifications, staff payroll records, and financial balance sheet.";
    }
    return "Support Staff: Attendance, inventory logging, and institutional notices.";
  }

  if (category === "TERTIARY") {
    if (norm.includes("lecturer") || norm.includes("graduate assistant") || norm.includes("professor") || norm.includes("reader")) {
      return "Lecturer / Academic Staff: Assigned to specific semester courses. Manages course Continuous Assessment (30% or 40%) and semester exams (70% or 60%), submits grade returns to HOD.";
    }
    if (norm.includes("hod") || norm.includes("head of department")) {
      return "Head of Department (HOD): Heads department, approves semester course allocations, vets lecturer score sheets, presents department broadsheet to Faculty Board.";
    }
    if (norm.includes("dean")) {
      return "Dean of Faculty / School: Oversees all academic departments in faculty, presides over Faculty Board of Examiners, endorses degree results to Senate.";
    }
    if (norm.includes("provost") || norm.includes("rector") || norm.includes("vice-chancellor") || norm.includes("vice chancellor")) {
      return "Executive Head: Institution-wide leadership, Senate chairmanship, statutory compliance, and university policy administration.";
    }
    if (norm.includes("registrar") || norm.includes("bursar")) {
      return "Registry / Bursary: Student matriculation records, transcript certification, staff payroll under CONTISS, and fiscal reporting.";
    }
    return "Technical / Admin Staff: Departmental lab maintenance, administrative memos, and examination hall logistics.";
  }

  return "Staff Member: Standard institutional access.";
}

// ============================================================================
// 9. NIGERIAN BANKS LIST
// ============================================================================
export const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Jaiz Bank",
  "Keystone Bank",
  "Lotus Bank",
  "Monnify / OPay",
  "Optimus Bank",
  "Palmpay",
  "Parallex Bank",
  "Polaris Bank",
  "PremiumTrust Bank",
  "Providus Bank",
  "Raenest",
  "Signature Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "TAJBank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
] as const;

// ============================================================================
// 10. TERTIARY PROFESSIONAL BODIES
// ============================================================================
export const TERTIARY_PROFESSIONAL_BODIES = [
  "COREN (Council for the Regulation of Engineering in Nigeria)",
  "ICAN (Institute of Chartered Accountants of Nigeria)",
  "ANAN (Association of National Accountants of Nigeria)",
  "NMCN (Nursing and Midwifery Council of Nigeria)",
  "MDCN (Medical and Dental Council of Nigeria)",
  "NBA (Nigerian Bar Association / Body of Benchers)",
  "NISP (Nigerian Institute of Safety Professionals)",
  "NIM (Nigerian Institute of Management)",
  "CPN (Computer Professionals Registration Council of Nigeria)",
  "NCS (Nigeria Computer Society)",
  "TRCN (Teachers Registration Council of Nigeria)",
  "SURCON (Surveyors Council of Nigeria)",
  "ARCON (Architects Registration Council of Nigeria)",
  "CORBON (Council of Registered Builders of Nigeria)",
  "Other Professional Regulatory Body",
] as const;
