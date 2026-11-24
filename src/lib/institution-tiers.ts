/**
 * ==============================================================================
 * SINGLE SOURCE OF TRUTH: INSTITUTION TIERS CONFIGURATION (TIER_CONFIG)
 * ==============================================================================
 * Authoritative matrix for all Nigerian Educational Institution Tiers:
 * - CRECHE (Early Childhood Care, Creche, Nursery, Kindergarten)
 * - PRIMARY (6-Year / 9-Year Basic Education Primary 1 - 6)
 * - SECONDARY (WAEC / NECO Junior & Senior Secondary JSS 1 - SSS 3)
 * - TERTIARY (NUC University 100 - 500 Level, NBTE Polytechnic ND/HND, NCCE College of Education NCE)
 *
 * Provides strictly scoped levels, terms/semesters, grading systems, report titles,
 * and dynamic terminology. No page should hardcode another tier's classes.
 */

export type InstitutionTierKey = "CRECHE" | "PRIMARY" | "SECONDARY" | "TERTIARY";
export type TertiarySubtype = "UNIVERSITY" | "POLYTECHNIC" | "COLLEGE_OF_EDUCATION" | "MONOTECHNIC" | "GENERAL";

export interface TierTerminology {
  // Period naming (Term vs Semester)
  periodNoun: string;               // "Term" vs "Semester"
  periodPlural: string;             // "Terms" vs "Semesters"
  periodSelectLabel: string;        // "Select Term" vs "Select Semester"
  periodChoosePlaceholder: string;  // "-- Choose Term --" vs "-- Choose Semester --"
  currentPeriodLabel: string;       // "Current Term" vs "Current Semester"

  // Level / Class naming
  levelNoun: string;                // "Care Pod / Group" vs "Class" vs "Class / Stream" vs "Level / Programme / Department"
  levelNounPlural: string;          // "Care Pods" vs "Classes" vs "Classes & Streams" vs "Academic Levels"
  levelSelectLabel: string;         // "Select Care Pod" vs "Select Class" vs "Select Class" vs "Select Level / Program"
  levelChoosePlaceholder: string;   // "-- Choose Care Pod --" vs "-- Choose Class --" vs "-- Choose Class --" vs "-- Choose Level / Program --"

  // People naming
  studentNoun: string;              // "Child" vs "Pupil" vs "Student" vs "Undergraduate"
  studentsNoun: string;             // "Children" vs "Pupils" vs "Students" vs "Undergraduates"
  teacherNoun: string;              // "Caregiver" vs "Class Teacher" vs "Subject Teacher" vs "Lecturer"
  teachersNoun: string;             // "Caregivers" vs "Class Teachers" vs "Subject Teachers" vs "Faculty"
  headNoun: string;                 // "Lead Caregiver" vs "Headmaster / Headmistress" vs "Principal" vs "Vice Chancellor / Rector"

  // Reports & Results naming
  reportTitle: string;              // "Milestone Progress Report" vs "Termly Academic Report Card" vs "Termly Academic Report Sheet" vs "Official Semester Academic Transcript"
  reportHeader: string;             // "Early Years Progress Reports" vs "Termly Report Cards" vs "Termly Report Sheets" vs "Semester Academic Transcripts"
  reportSubheader: string;          // Subtitle on reports page
  reportCardLabel: string;          // "Milestone Progress Reports" vs "Termly Report Cards" vs "Termly Report Sheets" vs "Semester Results / Transcript"
  reportCardSingular: string;       // "Milestone Report" vs "Report Card" vs "Report Sheet" vs "Transcript"

  // Academic Engine & Assessment naming
  assessmentLabel: string;          // "Developmental Milestone Review" vs "Continuous Assessment (CA)" vs "Continuous Assessment (CA) & Terminal Exam" vs "Continuous Assessment + Exam / GPA / CGPA"
  assessmentSubtitle: string;
  gradingSystem: string;            // Name of grading system
  rankingMetric: string;            // "Developmental Stage & Milestone Assessment" vs "Continuous Assessment & Class Position" vs "Terminal Exams, Class Position & Rank" vs "Grade Point Average (GPA & Cumulative CGPA)"
  curriculumLabel: string;          // "Early Learning Modules" vs "Primary Subjects" vs "Secondary Subjects" vs "Course Units & Syllabi"

  // Financial & Administrative
  revenueLabel: string;             // "Termly Revenue" vs "Semester Revenue"
  billingTitle: string;             // "Termly Tuition & Care Fees" vs "Termly School Fees" vs "Semester Tuition & Faculty Dues"
  broadsheetTitle: string;          // "Milestone Broadsheet" vs "Annual Compiled Sheet (1st + 2nd + 3rd Term)" vs "Terminal Grading Broadsheet" vs "Semester Broadsheet / Senate Broad Sheet"
  transcriptPdfTitle: string;       // PDF header title
  resumptionLabel: string;          // "Next Term Resumption Date" vs "Next Semester Resumption Date"
}

export interface InstitutionTierDefinition {
  key: InstitutionTierKey;
  name: string;
  badgeLabel: string;
  badgeCode: string;
  badgeColor: string;
  classes: string[];
  defaultClass: string;
  periods: string[];
  defaultPeriod: string;
  gradingSystem: string;
  reportTitle: string;
  terminology: TierTerminology;
}

export const INSTITUTION_TIERS: Record<InstitutionTierKey, InstitutionTierDefinition> = {
  CRECHE: {
    key: "CRECHE",
    name: "Early Years / Creche & Nursery",
    badgeLabel: "Early Childhood Care (Creche & Nursery)",
    badgeCode: "CRECHE",
    badgeColor: "bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800",
    classes: [
      "Creche",
      "Nursery 1",
      "Nursery 2",
      "Nursery 3",
      "Kindergarten",
    ],
    defaultClass: "Creche",
    periods: ["1st Term", "2nd Term", "3rd Term"],
    defaultPeriod: "1st Term",
    gradingSystem: "Montessori Milestone Mastery (Excellent / Very Good / Good / Developing / Needs Support)",
    reportTitle: "Child Growth & Developmental Progress Tracker",
    terminology: {
      periodNoun: "Term",
      periodPlural: "Terms",
      periodSelectLabel: "Select Term",
      periodChoosePlaceholder: "-- Choose Term --",
      currentPeriodLabel: "Academic Term",

      levelNoun: "Care Pod / Playgroup",
      levelNounPlural: "Care Pods",
      levelSelectLabel: "Select Care Pod",
      levelChoosePlaceholder: "-- Choose Care Pod --",

      studentNoun: "Child",
      studentsNoun: "Children",
      teacherNoun: "Caregiver",
      teachersNoun: "Caregivers",
      headNoun: "Head of Early Years",

      reportTitle: "Child Growth & Developmental Progress Tracker",
      reportHeader: "Early Years Progress Reports",
      reportSubheader: "Developmental milestone tracking, habit evaluation, pediatric vitals, and early childhood care logs.",
      reportCardLabel: "Milestone Progress Reports",
      reportCardSingular: "Milestone Progress Report",

      assessmentLabel: "Developmental Milestone Review",
      assessmentSubtitle: "Milestone tracking engine: early childhood growth, motor skills, and phonics.",
      gradingSystem: "Milestone Scale (Excellent / Very Good / Good / Developing / Needs Support)",
      rankingMetric: "Developmental Stage & Milestone Assessment",
      curriculumLabel: "Early Learning Modules & Sensory Play",

      revenueLabel: "Termly Care Revenue",
      billingTitle: "Termly Tuition & Care Fees",
      broadsheetTitle: "Early Years Developmental Broadsheet",
      transcriptPdfTitle: "OFFICIAL CHILD DEVELOPMENTAL PROGRESS REPORT & CARE PROFILE",
      resumptionLabel: "Next Term Resumption Date",
    },
  },

  PRIMARY: {
    key: "PRIMARY",
    name: "Primary School",
    badgeLabel: "Primary Education (Primary 1 - 6)",
    badgeCode: "PRIMARY",
    badgeColor: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    classes: [
      "Primary 1",
      "Primary 2",
      "Primary 3",
      "Primary 4",
      "Primary 5",
      "Primary 6",
    ],
    defaultClass: "Primary 1",
    periods: ["1st Term", "2nd Term", "3rd Term"],
    defaultPeriod: "1st Term",
    gradingSystem: "NERDC Primary Scale (Distinction / Very Good / Credit / Pass / Fail)",
    reportTitle: "Termly Academic Report Card",
    terminology: {
      periodNoun: "Term",
      periodPlural: "Terms",
      periodSelectLabel: "Select Term",
      periodChoosePlaceholder: "-- Choose Term --",
      currentPeriodLabel: "Current Term",

      levelNoun: "Class",
      levelNounPlural: "Classes",
      levelSelectLabel: "Select Class",
      levelChoosePlaceholder: "-- Choose Class --",

      studentNoun: "Pupil",
      studentsNoun: "Pupils",
      teacherNoun: "Class Teacher",
      teachersNoun: "Class Teachers",
      headNoun: "Headmaster / Headmistress",

      reportTitle: "Termly Academic Report Card",
      reportHeader: "Termly Report Cards",
      reportSubheader: "Continuous Assessment (CA) tracking, foundational exam scores, and automated report card generation.",
      reportCardLabel: "Termly Report Cards",
      reportCardSingular: "Termly Report Card",

      assessmentLabel: "Continuous Assessment (CA) tracking",
      assessmentSubtitle: "NERDC 20/20/60 continuous assessment and foundational academic evaluation.",
      gradingSystem: "NERDC Primary Scale (Distinction / Very Good / Credit / Pass / Fail)",
      rankingMetric: "Continuous Assessment & Class Position",
      curriculumLabel: "Primary School Curriculum",

      revenueLabel: "Termly Revenue",
      billingTitle: "Termly School Fees & Levies",
      broadsheetTitle: "Annual Compiled Broadsheet (1st + 2nd + 3rd Term)",
      transcriptPdfTitle: "OFFICIAL TERMLY CONTINUOUS ASSESSMENT & ACADEMIC REPORT SHEET",
      resumptionLabel: "Next Term Resumption Date",
    },
  },

  SECONDARY: {
    key: "SECONDARY",
    name: "Secondary School",
    badgeLabel: "Secondary Education (Junior & Senior)",
    badgeCode: "SECONDARY",
    badgeColor: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    classes: [
      "JSS 1",
      "JSS 2",
      "JSS 3",
      "SSS 1",
      "SSS 2",
      "SSS 3",
    ],
    defaultClass: "JSS 1",
    periods: ["1st Term", "2nd Term", "3rd Term"],
    defaultPeriod: "1st Term",
    gradingSystem: "WAEC / NECO Scale (A1, B2, B3, C4, C5, C6, D7, E8, F9)",
    reportTitle: "Termly Academic Report Sheet",
    terminology: {
      periodNoun: "Term",
      periodPlural: "Terms",
      periodSelectLabel: "Select Term",
      periodChoosePlaceholder: "-- Choose Term --",
      currentPeriodLabel: "Current Term",

      levelNoun: "Class / Stream",
      levelNounPlural: "Classes & Streams",
      levelSelectLabel: "Select Class",
      levelChoosePlaceholder: "-- Choose Class --",

      studentNoun: "Student",
      studentsNoun: "Students",
      teacherNoun: "Subject Teacher",
      teachersNoun: "Subject Teachers",
      headNoun: "Principal",

      reportTitle: "Termly Academic Report Sheet",
      reportHeader: "Termly Report Sheets",
      reportSubheader: "Continuous Assessment (CA) tracking, terminal WAEC/NECO examination scores, and report sheet compilation.",
      reportCardLabel: "Termly Report Sheets",
      reportCardSingular: "Termly Report Sheet",

      assessmentLabel: "Continuous Assessment (CA) & Terminal Exam",
      assessmentSubtitle: "WAEC / NECO standard continuous assessment and senior certificate moderation.",
      gradingSystem: "WAEC / NECO Scale (A1 - F9)",
      rankingMetric: "Terminal Exams, Class Position & Rank",
      curriculumLabel: "Junior & Senior Secondary Curriculum",

      revenueLabel: "Termly Revenue",
      billingTitle: "Termly School Fees & Academic Levies",
      broadsheetTitle: "Secondary Master Promotion Broadsheet",
      transcriptPdfTitle: "OFFICIAL TERMLY CONTINUOUS ASSESSMENT & ACADEMIC REPORT SHEET",
      resumptionLabel: "Next Term Resumption Date",
    },
  },

  TERTIARY: {
    key: "TERTIARY",
    name: "Higher Education / University",
    badgeLabel: "University (Undergraduate & Postgraduate)",
    badgeCode: "TERTIARY",
    badgeColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    classes: [
      "100 Level",
      "200 Level",
      "300 Level",
      "400 Level",
      "500 Level",
    ],
    defaultClass: "100 Level",
    periods: ["1st Semester", "2nd Semester"],
    defaultPeriod: "1st Semester",
    gradingSystem: "NUC / NBTE 5.0 / 4.0 Semester Examination System (A - F • GPA / CGPA)",
    reportTitle: "Official Semester Academic Transcript",
    terminology: {
      periodNoun: "Semester",
      periodPlural: "Semesters",
      periodSelectLabel: "Select Semester",
      periodChoosePlaceholder: "-- Choose Semester --",
      currentPeriodLabel: "Current Semester",

      levelNoun: "Level / Programme / Department",
      levelNounPlural: "Academic Levels & Programmes",
      levelSelectLabel: "Select Level / Program",
      levelChoosePlaceholder: "-- Choose Level / Program --",

      studentNoun: "Student",
      studentsNoun: "Undergraduates",
      teacherNoun: "Lecturer",
      teachersNoun: "Faculty",
      headNoun: "Vice Chancellor / Dean",

      reportTitle: "Official Semester Academic Transcript",
      reportHeader: "Semester Academic Transcripts",
      reportSubheader: "Course registration, Continuous Assessment + Exam / GPA / CGPA, semester GPA broadsheet, and academic transcripts.",
      reportCardLabel: "Semester Results / Transcript",
      reportCardSingular: "Semester Academic Transcript",

      assessmentLabel: "Continuous Assessment + Exam / GPA / CGPA",
      assessmentSubtitle: "Course registration, credit units, Continuous Assessment + Exam, and CGPA broadsheet.",
      gradingSystem: "NUC / NBTE 5.0 / 4.0 CGPA Grading System",
      rankingMetric: "Grade Point Average (GPA & Cumulative CGPA)",
      curriculumLabel: "Active Course Credit Loading & Units",

      revenueLabel: "Semester Revenue",
      billingTitle: "Semester Tuition & Faculty Dues",
      broadsheetTitle: "Sessional Master Broadsheet / Senate Broad Sheet",
      transcriptPdfTitle: "OFFICIAL SEMESTER ACADEMIC TRANSCRIPT & COURSE PERFORMANCE SHEET",
      resumptionLabel: "Next Semester Resumption Date",
    },
  },
};

/**
 * Polytechnic-specific tertiary classes and badge
 */
export const POLYTECHNIC_TIER_DEFINITION: InstitutionTierDefinition = {
  ...INSTITUTION_TIERS.TERTIARY,
  name: "Polytechnic / Monotechnic",
  badgeLabel: "Polytechnic (National & Higher Diploma)",
  badgeCode: "POLYTECHNIC",
  classes: ["ND 1", "ND 2", "HND 1", "HND 2"],
  defaultClass: "ND 1",
  terminology: {
    ...INSTITUTION_TIERS.TERTIARY.terminology,
    headNoun: "Rector",
    badgeLabel: "Polytechnic (National & Higher Diploma)",
  } as any,
};

/**
 * College of Education-specific tertiary classes and badge
 */
export const COLLEGE_OF_EDUCATION_TIER_DEFINITION: InstitutionTierDefinition = {
  ...INSTITUTION_TIERS.TERTIARY,
  name: "College of Education",
  badgeLabel: "College of Education (NCE)",
  badgeCode: "COLLEGE_OF_EDUCATION",
  classes: ["NCE 1", "NCE 2", "NCE 3"],
  defaultClass: "NCE 1",
  terminology: {
    ...INSTITUTION_TIERS.TERTIARY.terminology,
    headNoun: "Provost",
    badgeLabel: "College of Education (NCE)",
  } as any,
};

/**
 * Authoritative resolver: resolves the exact InstitutionTierDefinition for any school or tenant context.
 * Guarantees that:
 * - Creche / Nursery institutions NEVER see Primary / Secondary / Tertiary classes or terms.
 * - Secondary institutions NEVER see Creche / Primary / Tertiary classes or terms.
 * - Tertiary institutions NEVER see Creche / Nursery / Primary / Secondary classes or terms.
 */
export function getInstitutionTierConfig(input?: {
  id?: string;
  schoolId?: string;
  subdomain?: string | null;
  name?: string | null;
  tier?: string | null;
  preciseTier?: string | null;
  institutionType?: string | null;
  academicTiers?: Array<{ name?: string | null; level?: number | null }> | null;
}): InstitutionTierDefinition & { subtype?: TertiarySubtype } {
  if (!input) {
    return INSTITUTION_TIERS.PRIMARY;
  }

  const subdomain = (input.subdomain || "").toLowerCase().trim();
  const schoolName = (input.name || "").toUpperCase().trim();
  const rawTier = (input.preciseTier || input.tier || "").toUpperCase().trim();
  const instType = (input.institutionType || "").toUpperCase().trim();

  const academicTiers = Array.isArray(input.academicTiers) ? input.academicTiers : [];
  const tierNames = academicTiers.map((t) => (t?.name || "").toUpperCase().trim());

  // 1. Explicit Subdomain overrides for demo tenants
  if (subdomain === "demo-creche" || subdomain === "demo-nursery") {
    return INSTITUTION_TIERS.CRECHE;
  }
  if (subdomain === "demo-primary") {
    return INSTITUTION_TIERS.PRIMARY;
  }
  if (subdomain === "demo-secondary") {
    return INSTITUTION_TIERS.SECONDARY;
  }
  if (subdomain === "demo-university") {
    return { ...INSTITUTION_TIERS.TERTIARY, subtype: "UNIVERSITY" };
  }

  // 2. Explicit Tertiary checks (Polytechnic, COE, University)
  if (
    rawTier === "POLYTECHNIC" ||
    subdomain.includes("poly") ||
    schoolName.includes("POLYTECHNIC") ||
    tierNames.some((t) => t.includes("POLYTECHNIC"))
  ) {
    return { ...POLYTECHNIC_TIER_DEFINITION, subtype: "POLYTECHNIC" };
  }

  if (
    rawTier === "COLLEGE_OF_EDUCATION" ||
    schoolName.includes("COLLEGE OF EDUCATION") ||
    tierNames.some((t) => t.includes("COLLEGE OF EDUCATION") || t.includes("NCE"))
  ) {
    return { ...COLLEGE_OF_EDUCATION_TIER_DEFINITION, subtype: "COLLEGE_OF_EDUCATION" };
  }

  if (
    rawTier === "TERTIARY" ||
    rawTier === "UNIVERSITY" ||
    rawTier === "HIGHER_ED" ||
    instType === "HIGHER_ED" ||
    subdomain.includes("uni") ||
    schoolName.includes("UNIVERSITY") ||
    tierNames.some((t) => t.includes("UNIVERSITY") || t.includes("HIGHER"))
  ) {
    return { ...INSTITUTION_TIERS.TERTIARY, subtype: "UNIVERSITY" };
  }

  // 3. Early Years / Creche / Nursery checks
  if (
    rawTier === "CRECHE" ||
    rawTier === "NURSERY" ||
    subdomain.includes("creche") ||
    subdomain.includes("nursery") ||
    schoolName.includes("CRECHE") ||
    schoolName.includes("DAYCARE") ||
    schoolName.includes("EARLY") ||
    (schoolName.includes("NURSERY") && !schoolName.includes("PRIMARY") && !schoolName.includes("SECONDARY")) ||
    (tierNames.length > 0 &&
      tierNames.every((t) => t.includes("CRECHE") || t.includes("NURSERY") || t.includes("EARLY") || t.includes("KINDERGARTEN")))
  ) {
    return INSTITUTION_TIERS.CRECHE;
  }

  // 4. Secondary checks
  if (
    rawTier === "SECONDARY" ||
    subdomain.includes("sec") ||
    subdomain.includes("high") ||
    schoolName.includes("SECONDARY") ||
    schoolName.includes("HIGH SCHOOL") ||
    schoolName.includes("GRAMMAR") ||
    schoolName.includes("COLLEGE") || // e.g. King's College
    tierNames.some((t) => t.includes("SECONDARY") || t.includes("HIGH SCHOOL") || t.includes("JSS") || t.includes("SSS"))
  ) {
    return INSTITUTION_TIERS.SECONDARY;
  }

  // 5. Primary checks
  if (
    rawTier === "PRIMARY" ||
    subdomain.includes("prim") ||
    schoolName.includes("PRIMARY") ||
    schoolName.includes("BASIC") ||
    schoolName.includes("ELEMENTARY") ||
    tierNames.some((t) => t.includes("PRIMARY") || t.includes("BASIC") || t.includes("ELEMENTARY"))
  ) {
    return INSTITUTION_TIERS.PRIMARY;
  }

  // 6. Demo fallback for legacy "demo" (Apex International Academy):
  // Apex International Academy is an Academy -> Secondary tier
  if (subdomain === "demo" || schoolName.includes("APEX")) {
    return INSTITUTION_TIERS.SECONDARY;
  }

  // 7. Default fallback to Primary School
  return INSTITUTION_TIERS.PRIMARY;
}

/**
 * Filter any arbitrary class list so that ONLY classes matching the specified tier remain.
 */
export function filterClassesByTier(classes: string[], tierKey: InstitutionTierKey, tertiarySubtype?: TertiarySubtype): string[] {
  const normTier = tierKey.toUpperCase();
  const allowedSet = new Set<string>();

  if (normTier === "CRECHE" || normTier === "NURSERY") {
    INSTITUTION_TIERS.CRECHE.classes.forEach((c) => allowedSet.add(c.toLowerCase()));
  } else if (normTier === "SECONDARY") {
    INSTITUTION_TIERS.SECONDARY.classes.forEach((c) => allowedSet.add(c.toLowerCase()));
  } else if (normTier === "TERTIARY") {
    if (tertiarySubtype === "POLYTECHNIC") {
      POLYTECHNIC_TIER_DEFINITION.classes.forEach((c) => allowedSet.add(c.toLowerCase()));
    } else if (tertiarySubtype === "COLLEGE_OF_EDUCATION") {
      COLLEGE_OF_EDUCATION_TIER_DEFINITION.classes.forEach((c) => allowedSet.add(c.toLowerCase()));
    } else {
      INSTITUTION_TIERS.TERTIARY.classes.forEach((c) => allowedSet.add(c.toLowerCase()));
    }
  } else {
    INSTITUTION_TIERS.PRIMARY.classes.forEach((c) => allowedSet.add(c.toLowerCase()));
  }

  return classes.filter((cls) => {
    const clean = (cls || "").trim().toLowerCase();
    return allowedSet.has(clean);
  });
}
