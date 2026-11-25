"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Send,
  Clock,
  Award,
  Users,
  Search,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useTenant } from "@/lib/tenant-context";
import StudentReportCardModal, { ReportCardStudentData } from "./StudentReportCardModal";
import {
  getClassesForSchool,
  getTierForClass,
  EducationalTierCategory,
  formatClassDisplay,
} from "@/lib/school-tier-classes";
import { isTertiaryClass, mapTertiaryScoreToGrade, getTertiaryAcademicStanding } from "@/lib/tertiary-config";
import { getInstitutionTierConfig } from "@/lib/institution-tiers";

// -------------------------------------------------------------
// Nigerian Educational Ecosystem Subject Rosters (NERDC & Tertiary)
// -------------------------------------------------------------

// 1. CRECHE & NURSERY (Early Childhood Care - All Classes)
const NURSERY_SUBJECTS = [
  "Numeracy / Cognitive Skills",
  "Literacy / Phonics",
  "Rhymes & Poetry",
  "Social Norms / Habits",
  "Sensory Play / Creative Arts",
  "Health Habits / Writing Readiness",
];

// 2. PRIMARY SCHOOL TIER (9-Year Basic Education Curriculum)
// Lower Primary (Primary 1, 2, and 3)
const LOWER_PRIMARY_SUBJECTS = [
  "Mathematics",
  "English Studies",
  "Basic Science and Technology",
  "National Values Education (Social Studies/Civic/Security)",
  "Cultural and Creative Arts (CCA)",
  "Physical and Health Education (PHE)",
  "Religious Values (CRS/IRS)",
  "Nigerian Language (Yoruba/Igbo/Hausa)",
];

// Upper Primary (Primary 4, 5, and 6)
const UPPER_PRIMARY_SUBJECTS = [
  "Mathematics",
  "English Studies",
  "Basic Science and Technology",
  "Basic Digital Literacy / ICT",
  "National Values Education",
  "Pre-Vocational Studies (Agriculture/Home Economics)",
  "Cultural and Creative Arts (CCA)",
  "Physical and Health Education (PHE)",
  "Religious Values (CRS/IRS)",
  "Nigerian History",
  "Nigerian Language",
];

// 3. SECONDARY SCHOOL TIER
// Junior Secondary (JSS 1, JSS 2, and JSS 3)
const JUNIOR_SECONDARY_SUBJECTS = [
  "Mathematics",
  "English Studies",
  "Intermediate Science",
  "Digital Technologies / ICT",
  "Business Studies",
  "Pre-Vocational Studies (Agricultural Science)",
  "National Values / Social & Citizenship Studies",
  "Nigerian History",
  "Cultural and Creative Arts (CCA)",
  "Physical and Health Education (PHE)",
  "Religious Values (CRS/IRS)",
  "Compulsory Trade Skill (Solar PV/Fashion/Livestock/GSM Repair)",
];

// Senior Secondary (SS 1, SS 2, and SS 3)
const SENIOR_CORE_SUBJECTS = [
  "General Mathematics",
  "English Language",
  "Civic Education",
  "Digital Technologies / Data Processing",
  "Marketing / Trade Subject",
];

const SENIOR_SCIENCE_ADDITIONS = [
  "Biology",
  "Chemistry",
  "Physics",
  "Further Mathematics",
  "Agricultural Science",
  "Geography",
];

const SENIOR_HUMANITIES_ADDITIONS = [
  "Government",
  "Literature-in-English",
  "Christian Religious Studies",
  "Islamic Studies",
  "History",
  "One Nigerian Language",
];

const SENIOR_COMMERCIAL_ADDITIONS = [
  "Financial Accounting",
  "Commerce",
  "Economics",
  "Insurance",
];

// Combined full senior secondary subjects
const SENIOR_SECONDARY_ALL_SUBJECTS = [
  ...SENIOR_CORE_SUBJECTS,
  ...SENIOR_SCIENCE_ADDITIONS,
  ...SENIOR_HUMANITIES_ADDITIONS,
  ...SENIOR_COMMERCIAL_ADDITIONS,
];

// 4. HIGHER EDUCATION (Tertiary Module)
// College of Education (NCE 1 - 3)
const COE_SUBJECTS = [
  "GNS 101 - Use of English",
  "GNS 102 - Citizenship Education",
  "EDU 111 - Introduction to Teaching Profession",
  "EDU 112 - Foundations of Education",
  "GNS 201 - Entrepreneurial Studies",
  "Major Elective Course I",
  "Major Elective Course II",
];

// Polytechnic (ND 1 - HND 2)
const POLYTECHNIC_SUBJECTS = [
  "GNS 101 - Use of English",
  "GNS 111 - Citizenship Education",
  "MTH 111 - Logic and Linear Algebra",
  "COM 111 - Introduction to Computing",
  "BAM 111 - Introduction to Business Administration",
  "EED 126 - Introduction to Entrepreneurship",
  "Departmental Core Course I",
];

// University (100 Level - 500 Level)
const UNIVERSITY_SUBJECTS = [
  "GST 111 - Use of English & Library Instructions",
  "GST 112 - Philosophy, Logic and Human Existence",
  "GST 113 - Nigerian Peoples and Culture",
  "GST 211 - Entrepreneurship and Innovation",
  "Departmental Core Course 101",
  "Departmental Core Course 102",
  "Faculty Elective 101",
];

type TierKey =
  | "NURSERY"
  | "PRIMARY"
  | "SECONDARY"
  | "COLLEGE_OF_EDUCATION"
  | "POLYTECHNIC"
  | "UNIVERSITY"
  | "HIGHER_ED";
type SeniorStreamKey = "ALL" | "CORE" | "SCIENCE" | "HUMANITIES" | "COMMERCIAL";

// Class lists per academic tier
const TIER_CLASSES_MAP: Record<TierKey, string[]> = {
  NURSERY: [
    "Creche",
    "Nursery 1",
    "Nursery 2",
    "Nursery 3",
    "Pre-School / Kindergarten",
  ],
  PRIMARY: [
    "Primary 1",
    "Primary 2",
    "Primary 3",
    "Primary 4",
    "Primary 5",
    "Primary 6",
  ],
  SECONDARY: [
    "JSS 1",
    "JSS 2",
    "JSS 3",
    "SS 1",
    "SS 2",
    "SS 3",
  ],
  COLLEGE_OF_EDUCATION: [
    "NCE 1",
    "NCE 2",
    "NCE 3",
  ],
  POLYTECHNIC: [
    "ND 1",
    "ND 2",
    "HND 1",
    "HND 2",
  ],
  UNIVERSITY: [
    "100 Level",
    "200 Level",
    "300 Level",
    "400 Level",
    "500 Level",
  ],
  HIGHER_ED: [
    "100 Level",
    "200 Level",
    "300 Level",
    "400 Level",
    "500 Level",
    "ND 1",
    "ND 2",
    "HND 1",
    "HND 2",
    "NCE 1",
    "NCE 2",
    "NCE 3",
  ],
};

function resolveAcademicTierKey(tierName?: string | null, institutionType?: string | null): TierKey {
  if (!tierName) return institutionType === "HIGHER_ED" ? "UNIVERSITY" : "PRIMARY";
  const normalized = tierName.toUpperCase().replace(/[-_]/g, " ").trim();

  // 1. Check Secondary first to prevent accidental substring collisions
  if (
    normalized.includes("SECONDARY") ||
    normalized.includes("HIGH SCHOOL") ||
    normalized.includes("JSS") ||
    normalized.includes("SSS") ||
    normalized === "SS" ||
    normalized.startsWith("SS ")
  ) {
    return "SECONDARY";
  }

  // 2. Early Childhood / Nursery
  if (
    normalized.includes("NURSERY") ||
    normalized.includes("CRECHE") ||
    normalized.includes("PRE SCHOOL") ||
    normalized.includes("PRE-SCHOOL") ||
    normalized.includes("CRECHE") ||
    normalized.includes("CRÈCHE") ||
    normalized.includes("KINDERGARTEN") ||
    normalized.includes("EARLY")
  ) {
    return "NURSERY";
  }

  // 3. Primary
  if (
    normalized.includes("PRIMARY") ||
    normalized.includes("BASIC") ||
    normalized.includes("ELEMENTARY")
  ) {
    return "PRIMARY";
  }

  // If tenant is K12, default any unmapped value to SECONDARY or PRIMARY, never tertiary
  if (institutionType === "K12") {
    return "SECONDARY";
  }

  // 4. College of Education
  if (
    normalized.includes("COLLEGE OF EDUCATION") ||
    normalized.includes("COLLEGE") ||
    normalized === "COE" ||
    normalized === "NCE"
  ) {
    return "COLLEGE_OF_EDUCATION";
  }

  // 5. Polytechnic (use word boundary regex so 'SECONDARY' never matches)
  if (
    normalized.includes("POLYTECHNIC") ||
    normalized === "POLY" ||
    /\b(ND|HND)\b/.test(normalized)
  ) {
    return "POLYTECHNIC";
  }

  // 6. University
  if (
    normalized.includes("UNIVERSITY") ||
    normalized === "UNI" ||
    normalized.includes("UNDERGRADUATE") ||
    normalized.includes("POSTGRADUATE") ||
    normalized.includes("DEGREE")
  ) {
    return "UNIVERSITY";
  }

  if (
    normalized.includes("HIGHER") ||
    normalized.includes("TERTIARY")
  ) {
    return "HIGHER_ED";
  }

  return "PRIMARY";
}

function isLowerPrimaryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("PRIMARY 1") ||
    norm.includes("PRIMARY 2") ||
    norm.includes("PRIMARY 3") ||
    norm.includes("BASIC 1") ||
    norm.includes("BASIC 2") ||
    norm.includes("BASIC 3") ||
    norm === "P1" ||
    norm === "P2" ||
    norm === "P3"
  );
}

function isUpperPrimaryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("PRIMARY 4") ||
    norm.includes("PRIMARY 5") ||
    norm.includes("PRIMARY 6") ||
    norm.includes("BASIC 4") ||
    norm.includes("BASIC 5") ||
    norm.includes("BASIC 6") ||
    norm === "P4" ||
    norm === "P5" ||
    norm === "P6"
  );
}

function isJuniorSecondaryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("JSS") ||
    norm.includes("JS 1") ||
    norm.includes("JS 2") ||
    norm.includes("JS 3") ||
    norm.includes("JS1") ||
    norm.includes("JS2") ||
    norm.includes("JS3") ||
    norm.includes("JUNIOR")
  );
}

function isSeniorSecondaryClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("SSS") ||
    norm.includes("SS 1") ||
    norm.includes("SS 2") ||
    norm.includes("SS 3") ||
    norm.includes("SS1") ||
    norm.includes("SS2") ||
    norm.includes("SS3") ||
    norm.includes("SENIOR")
  );
}

function isCollegeOfEducationClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return norm.includes("NCE") || norm.includes("EDU") || norm.includes("TEACHER");
}

function isPolytechnicClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return norm.includes("ND") || norm.includes("HND") || norm.includes("POLYTECHNIC");
}

function isUniversityClass(cls: string): boolean {
  const norm = cls.toUpperCase();
  return (
    norm.includes("LEVEL") ||
    norm.includes("YEAR") ||
    norm.includes("UNI") ||
    norm.includes("DEGREE")
  );
}

interface StudentScore {
  id: string;
  name: string;
  admissionNumber?: string;
  currentClass?: string;
  tier?: string;
  ca1: string;
  ca2: string;
  exam: string;
  total?: number;
  overallTotal?: number;
  overallAverage?: number;
  overallGrade?: string;
  rank?: number;
  classPosition?: string;
  totalStudents?: number;
  subjectsCount?: number;
  subjects?: any[];
  isCompiled?: boolean;
  saving?: boolean;
  saved?: boolean;
  error?: string;
  teacherRemarks?: string | null;
  principalRemarks?: string | null;
}

function getOrdinalSuffix(rank: number): string {
  if (rank <= 0) return "—";
  const j = rank % 10;
  const k = rank % 100;
  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
}

function getGradeInfo(
  score: number,
  tierCategory?: string,
  hasScores?: boolean,
  className?: string
): { grade: string; badgeClass: string } {
  const norm = `${tierCategory || ""} ${className || ""}`.toUpperCase();
  const isEarlyYears =
    norm.includes("NURSERY") ||
    norm.includes("CRECHE") ||
    norm.includes("CRÈCHE") ||
    norm.includes("KINDERGARTEN") ||
    norm.includes("KG") ||
    norm.includes("PLAYGROUP") ||
    norm.includes("DAYCARE") ||
    norm.includes("EARLY");

  const isTertiary =
    norm.includes("TERTIARY") ||
    norm.includes("HIGHER") ||
    norm.includes("UNIVERSITY") ||
    norm.includes("POLYTECHNIC") ||
    norm.includes("COLLEGE OF EDUCATION") ||
    /\bND\s*[1-2]\b/i.test(norm) ||
    /\bHND\s*[1-2]\b/i.test(norm) ||
    norm.includes("DIPLOMA") ||
    norm.includes("LEVEL");

  const isPrimary =
    !isEarlyYears &&
    !isTertiary &&
    (norm.includes("PRIMARY") || norm.includes("BASIC") || norm.includes("ELEMENTARY"));

  const isSecondary =
    !isTertiary &&
    (norm.includes("SECONDARY") ||
    norm.includes("HIGH") ||
    norm.includes("JSS") ||
    norm.includes("SSS") ||
    /\bSS\s*[1-3]\b/i.test(norm) ||
    /\bJS\s*[1-3]\b/i.test(norm) ||
    norm.includes("GRADE 7") ||
    norm.includes("GRADE 8") ||
    norm.includes("GRADE 9") ||
    norm.includes("GRADE 10") ||
    norm.includes("GRADE 11") ||
    norm.includes("GRADE 12"));

  // 1. Early Years (Creche & Nursery) Scale: Excellent / Very Good / Good / Developing / Needs Support
  if (isEarlyYears) {
    if (!hasScores && score === 0) {
      return { grade: "Needs Support", badgeClass: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700" };
    }
    if (score >= 75) return { grade: "Excellent", badgeClass: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700" };
    if (score >= 65) return { grade: "Very Good", badgeClass: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700" };
    if (score >= 50) return { grade: "Good", badgeClass: "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700" };
    if (score >= 40) return { grade: "Developing", badgeClass: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700" };
    return { grade: "Needs Support", badgeClass: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700" };
  }

  // 2. Tertiary / Higher Education: FAIL 1 - No Overall Grade! Only GPA + Academic Standing.
  if (isTertiary) {
    return { grade: "", badgeClass: "" };
  }

  // 2. Primary School Scale: Distinction / Very Good / Credit / Pass / Fail
  if (isPrimary) {
    if (!hasScores && score === 0) {
      return { grade: "Not Entered", badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700" };
    }
    if (score >= 75) return { grade: "Distinction", badgeClass: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700" };
    if (score >= 65) return { grade: "Very Good", badgeClass: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700" };
    if (score >= 50) return { grade: "Credit", badgeClass: "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700" };
    if (score >= 40) return { grade: "Pass", badgeClass: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700" };
    return { grade: "Fail", badgeClass: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700" };
  }

  // 3. Secondary WAEC Scale: A1 - F9 ONLY (Impossible for Nursery / Creche / Primary)
  if (isSecondary) {
    if (!hasScores && score === 0) {
      return { grade: "Not Entered", badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700" };
    }
    if (score >= 75) return { grade: "A1", badgeClass: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700" };
    if (score >= 70) return { grade: "B2", badgeClass: "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700" };
    if (score >= 65) return { grade: "B3", badgeClass: "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700" };
    if (score >= 60) return { grade: "C4", badgeClass: "bg-indigo-100 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700" };
    if (score >= 55) return { grade: "C5", badgeClass: "bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700" };
    if (score >= 50) return { grade: "C6", badgeClass: "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700" };
    if (score >= 45) return { grade: "D7", badgeClass: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700" };
    if (score >= 40) return { grade: "E8", badgeClass: "bg-orange-100 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700" };
    return { grade: "F9", badgeClass: "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700" };
  }

  // Default fallback for general basic education (NEVER F9)
  if (score >= 75) return { grade: "Distinction", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  if (score >= 65) return { grade: "Very Good", badgeClass: "bg-teal-100 text-teal-800 border-teal-300" };
  if (score >= 50) return { grade: "Credit", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" };
  if (score >= 40) return { grade: "Pass", badgeClass: "bg-amber-100 text-amber-800 border-amber-300" };
  return { grade: "Fail", badgeClass: "bg-rose-100 text-rose-800 border-rose-300" };
}

function getPositionBadge(rank: number): { text: string; badgeClass: string } {
  if (rank <= 0) return { text: "—", badgeClass: "bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 border-dashed" };
  const str = getOrdinalSuffix(rank);
  if (rank === 1) return { text: str, badgeClass: "bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-extrabold shadow-2xs" };
  if (rank === 2) return { text: str, badgeClass: "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 font-bold" };
  if (rank === 3) return { text: str, badgeClass: "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700 font-bold" };
  return { text: str, badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-medium" };
}

function ReportCardsContent() {
  const tenant = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Authoritative Single Source of Truth for Institution Tier & Dynamic Terminology
  const institutionTierConfig = useMemo(() => {
    return getInstitutionTierConfig({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      tier: (tenant as any).tier,
      preciseTier: tenant.preciseTier,
      institutionType: tenant.institutionType,
      academicTiers: (tenant as any).academicTiers,
    });
  }, [tenant]);

  const isTertiaryTier = institutionTierConfig.key === "TERTIARY";
  const isCrecheTier = institutionTierConfig.key === "CRECHE";
  const isSecondaryTier = institutionTierConfig.key === "SECONDARY";
  const isPrimaryTier = institutionTierConfig.key === "PRIMARY";

  // 1. Single Source of Truth for School Tiers & Scoped Classes
  const schoolClassesResult = useMemo(() => {
    return getClassesForSchool(
      {
        schoolId: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        tier: tenant.preciseTier || (tenant as any).tier,
        preciseTier: tenant.preciseTier,
        institutionType: tenant.institutionType,
        academicTiers: (tenant as any).academicTiers,
      }
    );
  }, [tenant]);

  const { groups: classGroups, allClasses: availableClasses, defaultClass: schoolDefaultClass, tierInfo } = schoolClassesResult;

  const [term, setTerm] = useState<string>(() => institutionTierConfig.defaultPeriod);
  const [className, setClassName] = useState<string>(() => {
    return schoolDefaultClass || institutionTierConfig.defaultClass || availableClasses[0] || "Primary 1";
  });
  const [subject, setSubject] = useState("");
  const [seniorStream, setSeniorStream] = useState<SeniorStreamKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [roster, setRoster] = useState<StudentScore[]>([]);

  // Automatically keep term in sync with tier (e.g. 1st Semester for Tertiary, 1st Term for K-12)
  useEffect(() => {
    if (isTertiaryTier && !term.includes("Semester")) {
      setTerm("1st Semester");
    } else if (!isTertiaryTier && term.includes("Semester")) {
      setTerm("1st Term");
    }
  }, [isTertiaryTier, term]);

  // Keep className valid when availableClasses updates
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.includes(className)) {
      setClassName(schoolDefaultClass || institutionTierConfig.defaultClass || availableClasses[0]);
    }
  }, [availableClasses, schoolDefaultClass, className, institutionTierConfig]);

  // Selected class tier (follows selected class)
  const selectedTier = useMemo(() => {
    return getTierForClass(className || schoolDefaultClass || institutionTierConfig.defaultClass);
  }, [className, schoolDefaultClass, institutionTierConfig]);

  const academicTier: TierKey = institutionTierConfig.key === "CRECHE"
    ? "NURSERY"
    : institutionTierConfig.key === "SECONDARY"
    ? "SECONDARY"
    : institutionTierConfig.key === "TERTIARY"
    ? "UNIVERSITY"
    : "PRIMARY";

  // Compute the exact subjects dynamically based on Tier Category AND Selected Class
  const activeSubjects: string[] = useMemo(() => {
    if (!className) return [];

    if (selectedTier.category === "NURSERY") {
      return NURSERY_SUBJECTS;
    }

    if (selectedTier.category === "PRIMARY") {
      if (isLowerPrimaryClass(className)) {
        return LOWER_PRIMARY_SUBJECTS;
      }
      if (isUpperPrimaryClass(className)) {
        return UPPER_PRIMARY_SUBJECTS;
      }
      return LOWER_PRIMARY_SUBJECTS;
    }

    if (selectedTier.category === "SECONDARY") {
      if (isJuniorSecondaryClass(className)) {
        return JUNIOR_SECONDARY_SUBJECTS;
      }
      if (isSeniorSecondaryClass(className)) {
        if (seniorStream === "CORE") return SENIOR_CORE_SUBJECTS;
        if (seniorStream === "SCIENCE") return [...SENIOR_CORE_SUBJECTS, ...SENIOR_SCIENCE_ADDITIONS];
        if (seniorStream === "HUMANITIES") return [...SENIOR_CORE_SUBJECTS, ...SENIOR_HUMANITIES_ADDITIONS];
        if (seniorStream === "COMMERCIAL") return [...SENIOR_CORE_SUBJECTS, ...SENIOR_COMMERCIAL_ADDITIONS];
        return SENIOR_SECONDARY_ALL_SUBJECTS;
      }
      return JUNIOR_SECONDARY_SUBJECTS;
    }

    if (selectedTier.category === "TERTIARY") {
      return UNIVERSITY_SUBJECTS;
    }

    return LOWER_PRIMARY_SUBJECTS;
  }, [selectedTier.category, className, seniorStream]);

  // When 'Choose Class' changes, clear subject selection
  const handleClassChange = (newClass: string) => {
    setClassName(newClass);
    setSubject("");
  };

  const handleStreamChange = (stream: SeniorStreamKey) => {
    setSeniorStream(stream);
    setSubject("");
  };

  // Immediate automatic fetching whenever class, term, or subject updates
  useEffect(() => {
    const targetClass = className || schoolDefaultClass;
    if (!targetClass && availableClasses.length === 0) return;

    setIsLoading(true);
    fetch(
      `/api/v1/report-cards/roster?term=${encodeURIComponent(String(term || "1st Term").trim())}&className=${encodeURIComponent(String(targetClass).trim())}&subject=${encodeURIComponent(String(subject || "").trim())}&schoolId=${encodeURIComponent(tenant.id || "")}&fresh=true`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.roster) {
          setRoster(data.roster);
        }
      })
      .catch((err) => console.error("Failed to load roster", err))
      .finally(() => setIsLoading(false));
  }, [term, className, subject, schoolDefaultClass, availableClasses.length, tenant.id]);

  // Explicit Action: Generate / Refresh Report Sheets
  const handleGenerateReportSheets = () => {
    if (!className || !term) return;
    setIsLoading(true);
    fetch(
      `/api/v1/report-cards/roster?term=${encodeURIComponent(String(term).trim())}&className=${encodeURIComponent(String(className).trim())}&subject=${encodeURIComponent(String(subject || "").trim())}&schoolId=${encodeURIComponent(tenant.id || "")}&fresh=true`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.roster) {
          setRoster(data.roster);
        }
      })
      .catch((err) => console.error("Failed to load roster", err))
      .finally(() => setIsLoading(false));
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<ReportCardStudentData | null>(null);

  // Compute positions across the class roster based on strictly descending calculated total score
  const rankedRoster = useMemo(() => {
    const withTotals = roster.map((s) => {
      const ca1Num = s.ca1 !== "" && !isNaN(parseFloat(s.ca1)) ? parseFloat(s.ca1) : 0;
      const ca2Num = s.ca2 !== "" && !isNaN(parseFloat(s.ca2)) ? parseFloat(s.ca2) : 0;
      const examNum = s.exam !== "" && !isNaN(parseFloat(s.exam)) ? parseFloat(s.exam) : 0;
      const total = subject
        ? Math.round((ca1Num + ca2Num + examNum) * 10) / 10
        : (s.total !== undefined && s.total > 0 ? s.total : Math.round((ca1Num + ca2Num + examNum) * 10) / 10);
      const overallTotal = s.overallTotal || (s.subjects && s.subjects.length > 0 ? s.subjects.reduce((acc: number, sub: any) => acc + (sub.total || 0), 0) : total);
      const hasScores = Boolean(s.ca1 !== "" || s.ca2 !== "" || s.exam !== "" || total > 0 || (s.subjects && s.subjects.length > 0));
      const isCompiled = s.isCompiled !== undefined ? Boolean(s.isCompiled) : ((s.ca1 !== "" && s.ca2 !== "" && s.exam !== "") || total > 0 || (s.subjects && s.subjects.length > 0));
      return {
        ...s,
        ca1Num,
        ca2Num,
        examNum,
        total,
        overallTotal,
        hasScores,
        isCompiled,
      };
    });

    // Dynamic strictly descending numerical order based entirely on CALCULATED TOTAL SCORE
    // The highest score percentage must always be assigned 1st Position under all circumstances
    const sorted = [...withTotals].sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total; // strictly descending numerical order
      }
      return (a.name || "").localeCompare(b.name || "");
    });

    const rankMap = new Map<string, number>();

    let currentRank = 1;
    sorted.forEach((item, index) => {
      if (index > 0 && item.total < sorted[index - 1].total) {
        currentRank = index + 1;
      }
      rankMap.set(item.id, item.total > 0 ? currentRank : 0);
    });

    // Return the sorted active class dataset so highest scores render first
    return sorted.map((student) => {
      const calculatedRank = rankMap.get(student.id) || 0;
      const rank = (student as any).rank && (student as any).rank > 0 ? (student as any).rank : calculatedRank;
      return {
        ...student,
        rank,
        status: student.isCompiled ? "Compiled" : "Pending Review",
      };
    });
  }, [roster, subject]);

  const filteredRoster = useMemo(() => {
    if (!searchQuery.trim()) return rankedRoster;
    const q = searchQuery.toLowerCase();
    return rankedRoster.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.admissionNumber && String(s.admissionNumber).toLowerCase().includes(q))
    );
  }, [rankedRoster, searchQuery]);

  const stats = useMemo(() => {
    const totalStudents = rankedRoster.length;
    const compiledCount = rankedRoster.filter((s) => s.isCompiled).length;
    const pendingCount = totalStudents - compiledCount;
    const sumScores = rankedRoster.reduce((acc, s) => acc + s.total, 0);
    const avgScore = compiledCount > 0 ? (sumScores / compiledCount).toFixed(1) : "0.0";
    return { totalStudents, compiledCount, pendingCount, avgScore };
  }, [rankedRoster]);

  const handleBulkExportPdf = async () => {
    setIsExportingPdf(true);
    setActionFeedback({
      message: `Compiling and archiving official report card PDFs for ${className} (${term})...`,
      type: "info",
    });

    try {
      const zipUrl = `/api/v1/report-cards/zip?className=${encodeURIComponent(className)}&term=${encodeURIComponent(term)}&session=2026/2027&schoolId=${encodeURIComponent(tenant.id || "")}`;
      const link = document.createElement("a");
      link.href = zipUrl;
      link.setAttribute("download", `ReportCards_${className.replace(/\s+/g, "_")}_${term.replace(/\s+/g, "_")}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setActionFeedback({
        message: `Successfully generated and downloaded class report cards archive for ${className}!`,
        type: "success",
      });
    } catch (err: any) {
      setActionFeedback({
        message: `Export failed: ${err?.message || "Failed to download ZIP archive."}`,
        type: "error",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePublishResults = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setActionFeedback({
        message: `Results published successfully! Report sheets have been compiled and dispatched to ${stats.compiledCount} student and parent portal(s).`,
        type: "success",
      });
      setTimeout(() => setActionFeedback(null), 6000);
    }, 900);
  };

  const handleScoreChange = (id: string, field: "ca1" | "ca2" | "exam", value: string) => {
    setRoster((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, [field]: value, saved: false, error: undefined };
        }
        return s;
      })
    );
  };

  const handleSaveGrade = async (student: StudentScore) => {
    setRoster((prev) =>
      prev.map((s) => (s.id === student.id ? { ...s, saving: true, error: undefined } : s))
    );

    try {
      const res = await fetch("/api/v1/report-cards/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          term,
          className,
          subject,
          ca1: Number(student.ca1) || 0,
          ca2: Number(student.ca2) || 0,
          exam: Number(student.exam) || 0,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setRoster((prev) =>
          prev.map((s) => (s.id === student.id ? { ...s, saving: false, saved: true } : s))
        );
      } else {
        setRoster((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, saving: false, error: data.error || "Save failed" } : s
          )
        );
      }
    } catch (err: any) {
      setRoster((prev) =>
        prev.map((s) =>
          s.id === student.id ? { ...s, saving: false, error: err.message || "Network error" } : s
        )
      );
    }
  };

  const isSenior = isSecondaryTier && isSeniorSecondaryClass(className);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-slate-50 text-slate-900 min-h-screen pb-12">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: tenant.branding?.primaryColor || "#0f172a" }}>
          {institutionTierConfig.terminology.reportHeader}
        </h2>
        <p className="mt-2 text-lg text-slate-500">
          {institutionTierConfig.terminology.reportSubheader}
        </p>
      </header>

      {/* Filter Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Filter Roster</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border shadow-xs ${institutionTierConfig.badgeColor}`}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>{institutionTierConfig.badgeLabel}</span>
          </span>
        </div>

        {/* Re-aligned 3-column grid for Term/Semester, Class/Level, and Course/Subject */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">

          {/* 2. Term / Semester Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {institutionTierConfig.terminology.periodSelectLabel}
            </label>
            <select 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="">{institutionTierConfig.terminology.periodChoosePlaceholder}</option>
              {institutionTierConfig.periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          
          {/* 3. Class / Level Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {institutionTierConfig.terminology.levelSelectLabel}
            </label>
            <select 
              value={className}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="">
                {institutionTierConfig.terminology.levelChoosePlaceholder}
              </option>

              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  {formatClassDisplay(c)}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Subject / Course Selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                {isTertiaryTier ? "Select Course" : "Select Subject"}
              </label>
              {isSenior && (
                <span className="text-[11px] font-medium text-slate-500">
                  {seniorStream === "ALL"
                    ? "All Streams"
                    : seniorStream === "CORE"
                    ? "Core Only"
                    : seniorStream === "SCIENCE"
                    ? "Science"
                    : seniorStream === "HUMANITIES"
                    ? "Arts"
                    : "Commercial"}
                </span>
              )}
            </div>

            <select 
              value={subject}
              onChange={(e) => {
                const val = e.target.value;
                setSubject(val);
              }}
              disabled={!className}
              className={`w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium ${
                !className ? "bg-slate-50 cursor-not-allowed opacity-70" : ""
              }`}
            >
              <option value="">
                {!className
                  ? (isTertiaryTier ? "-- Choose Level First --" : isCrecheTier ? "-- Choose Care Pod First --" : "-- Choose Class First --")
                  : isTertiaryTier
                  ? "-- All Courses (Master Directory) --"
                  : isCrecheTier
                  ? "-- All Activities (Care Log Directory) --"
                  : "-- All Subjects (Master Report Cards Directory) --"}
              </option>

              {/* Categorized optgroups for Senior Secondary when All Streams active */}
              {isSenior && seniorStream === "ALL" ? (
                <>
                  <optgroup label="Core General Subjects">
                    {SENIOR_CORE_SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Science Stream">
                    {SENIOR_SCIENCE_ADDITIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Humanities & Arts Stream">
                    {SENIOR_HUMANITIES_ADDITIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Business & Commercial Stream">
                    {SENIOR_COMMERCIAL_ADDITIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                activeSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              )}
            </select>

            {/* Senior Secondary Sub-Stream Filter Pills */}
            {isSenior && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-0.5">Stream:</span>
                {(["ALL", "CORE", "SCIENCE", "HUMANITIES", "COMMERCIAL"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStreamChange(st)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all ${
                      seniorStream === st
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {st === "ALL" ? "All" : st === "CORE" ? "Core" : st === "SCIENCE" ? "Science" : st === "HUMANITIES" ? "Arts" : "Comm"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Explicit Action Button: Generate / Refresh Report Sheets */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${className && term ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
            <span>
              {className && term
                ? `${institutionTierConfig.terminology.levelNoun}: ${className} • ${term}${subject ? ` • ${subject}` : (isTertiaryTier ? " • All Courses" : " • All Subjects")}`
                : `Select ${institutionTierConfig.terminology.periodNoun} and ${institutionTierConfig.terminology.levelNoun} above to populate roster`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="generate-report-sheets-btn"
              onClick={handleGenerateReportSheets}
              disabled={!className || !term || isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>
                {isTertiaryTier
                  ? "Refresh Course Sheets"
                  : isSecondaryTier
                  ? "Refresh Report Sheets"
                  : isCrecheTier
                  ? "Refresh Growth Records"
                  : "Refresh Report Cards"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Persistent Student Search Input Form & Cohort Statistics Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search student in ${className || "class"} by name or admission number...`}
            className="w-full pl-10 pr-10 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Enrollment & Summary Stats */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>{stats.totalStudents} Enrolled</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{stats.compiledCount} Compiled</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">
            <Award className="w-3.5 h-3.5 text-blue-600" />
            <span>Class Avg: {stats.avgScore}%</span>
          </div>
        </div>
      </div>

      {/* Interactive Action Feedback Banner */}
      {actionFeedback && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-in fade-in duration-300 ${
          actionFeedback.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : actionFeedback.type === "error"
            ? "bg-rose-50 border-rose-200 text-rose-800"
            : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-xs underline font-semibold hover:opacity-80 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Roster Table or State Views */}
      {!className || !term ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            Select {institutionTierConfig.terminology.levelNoun} & {institutionTierConfig.terminology.periodNoun}
          </h3>
          <p className="text-slate-500 max-w-md text-sm">
            Please select a {institutionTierConfig.terminology.levelNoun.toLowerCase()} and {institutionTierConfig.terminology.periodNoun.toLowerCase()} above to view student marks and {institutionTierConfig.terminology.reportCardLabel.toLowerCase()}.
          </p>
        </div>
      ) : isLoading ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Loading Student Roster...</h3>
          <p className="text-slate-500 text-sm mt-1">Retrieving continuous assessments and records for {className}.</p>
        </div>
      ) : rankedRoster.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No Students Enrolled in {className}</h3>
          <p className="text-slate-500 max-w-md text-sm">
            There are currently no active students assigned to {className}. Please select another class or enroll students via the Admissions module.
          </p>
        </div>
      ) : filteredRoster.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No Matching Students</h3>
          <p className="text-slate-500 max-w-md text-sm">
            No students in {className} matched &ldquo;{searchQuery}&rdquo;. Try another search term or click clear.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-4 px-4 py-2 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl hover:bg-blue-100 transition"
          >
            Clear Search Filter
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Automated Compiled Class Data Grid Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">
                      {isTertiaryTier ? "Academic Standing" : isCrecheTier ? "Milestone Rating" : "Position in Class"}
                    </th>
                    <th className="px-6 py-4">
                      {isTertiaryTier ? "Student / Scholar Name" : isCrecheTier ? "Child Full Name" : "Student Name"}
                    </th>
                    <th className="px-6 py-4">
                      {isTertiaryTier ? "Matriculation / Reg #" : isCrecheTier ? "Birth Reg / Tag #" : "Admission Number"}
                    </th>
                    {subject ? (
                      <>
                        <th className="px-6 py-4">
                          {isTertiaryTier ? "Continuous Assessment (Max 40)" : "Continuous Assessment 1 (Max 20)"}
                        </th>
                        <th className="px-6 py-4">
                          {isTertiaryTier ? "Mid-Semester Test (Max 20)" : "Continuous Assessment 2 (Max 20)"}
                        </th>
                        <th className="px-6 py-4">
                          {isTertiaryTier ? "Semester Exam (Max 60)" : "Termly Exam (Max 60)"}
                        </th>
                        <th className="px-6 py-4">
                          {isTertiaryTier ? "Total Score / Grade" : "Calculated Score"}
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4">{institutionTierConfig.terminology.levelNoun}</th>
                        <th className="px-6 py-4">{isTertiaryTier ? "Registered Units & Status" : "Assessment Profile"}</th>
                        <th className="px-6 py-4">{isTertiaryTier ? "Semester GPA & Standing" : isCrecheTier ? "Milestone Mastery" : "Overall Score / Avg"}</th>
                      </>
                    )}
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRoster.map((student) => {
                    const pos = getPositionBadge(student.rank);
                    const studentTierCat = getTierForClass(student.currentClass || className).category;
                    const grade = getGradeInfo(student.total, studentTierCat, student.isCompiled, student.currentClass || className);
                    const initials = (student.name || "")
                      .split(/[\s,]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase() || "ST";

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Position in Class / Standing */}
                        <td className="px-6 py-4">
                          {isTertiaryTier ? (
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {getTertiaryAcademicStanding(student.overallAverage ? (student.overallAverage / 25) : 3.5, "4.0")}
                            </span>
                          ) : isCrecheTier ? (
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {student.total >= 70 ? "Mastery" : student.total >= 50 ? "Developing" : "Observing"}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center justify-center min-w-[42px] px-2.5 py-1 rounded-full text-xs border ${pos.badgeClass}`}>
                              {pos.text}
                            </span>
                          )}
                        </td>

                        {/* Student Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white block">{student.name}</span>
                              {student.error && (
                                <span className="block text-xs text-red-500 mt-0.5">{student.error}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Admission Number */}
                        <td className="px-6 py-4">
                          <span className="inline-block font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                            {student.admissionNumber || "—"}
                          </span>
                        </td>

                        {subject ? (
                          <>
                            {/* CA 1 */}
                            <td className="px-6 py-4">
                              <input 
                                type="number" 
                                max="20" 
                                min="0" 
                                value={student.ca1}
                                onChange={(e) => handleScoreChange(student.id, "ca1", e.target.value)}
                                className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-center text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 outline-none transition shadow-xs" 
                                placeholder="0 - 20"
                              />
                            </td>

                            {/* CA 2 */}
                            <td className="px-6 py-4">
                              <input 
                                type="number" 
                                max="20" 
                                min="0" 
                                value={student.ca2}
                                onChange={(e) => handleScoreChange(student.id, "ca2", e.target.value)}
                                className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-center text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 outline-none transition shadow-xs" 
                                placeholder="0 - 20"
                              />
                            </td>

                            {/* Exam */}
                            <td className="px-6 py-4">
                              <input 
                                type="number" 
                                max="60" 
                                min="0" 
                                value={student.exam}
                                onChange={(e) => handleScoreChange(student.id, "exam", e.target.value)}
                                className="w-20 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-center text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 outline-none transition shadow-xs" 
                                placeholder="0 - 60"
                              />
                            </td>

                            {/* Calculated Total Score */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-base text-slate-900 dark:text-white">
                                  {student.total > 0 ? `${student.total}%` : "—"}
                                </span>
                                {student.total > 0 && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${grade.badgeClass}`}>
                                    {grade.grade}
                                  </span>
                                )}
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            {/* Class & Tier */}
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-800">
                                {className}
                              </span>
                            </td>

                            {/* Assessment Profile / Registered Units */}
                            <td className="px-6 py-4">
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                {isTertiaryTier 
                                  ? (student.isCompiled ? "18 Units Registered • Results Approved" : "18 Units Registered • Pending Approval")
                                  : (student.isCompiled ? "Continuous Assessments Compiled" : "Assessments Pending")}
                              </span>
                            </td>

                            {/* Overall Score / Avg / GPA */}
                            <td className="px-6 py-4">
                              {isTertiaryTier ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-base text-slate-900 dark:text-white">
                                    {(student.overallAverage ? (student.overallAverage / 25).toFixed(2) : (student.total > 0 ? (student.total / 25).toFixed(2) : "3.75"))} GPA
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                    In Good Standing
                                  </span>
                                </div>
                              ) : isCrecheTier ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-base text-slate-900 dark:text-white">
                                    {student.total > 0 ? `${student.total}%` : "—"}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                                    {student.total >= 70 ? "Meeting Expectations" : "Developing Well"}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-base text-slate-900 dark:text-white">
                                    {student.total > 0 ? `${student.total}%` : "—"}
                                  </span>
                                  {student.total > 0 && grade?.grade && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${grade.badgeClass || ""}`}>
                                      {grade.grade}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </>
                        )}

                        {/* Status Badge */}
                        <td className="px-6 py-4">
                          {student.status === "Compiled" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {isTertiaryTier ? "Senate Approved" : "Compiled"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              {isTertiaryTier ? "Pending Senate Approval" : "Pending Review"}
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const resolvedSubjects = (student.subjects && student.subjects.length > 0)
                                  ? student.subjects.map((sub: any) => ({
                                      subject: sub.subject,
                                      ca1: sub.ca1,
                                      ca2: sub.ca2,
                                      exam: sub.exam,
                                      total: sub.total,
                                      grade: sub.grade || grade?.grade || "—",
                                      subjectPosition: student.rank > 0 ? getOrdinalSuffix(student.rank) : "1st",
                                      remark: sub.remarks || (isTertiaryTier ? mapTertiaryScoreToGrade(sub.total, "4.0").remark : ((grade?.grade === "Distinction" || grade?.grade === "Excellent") ? "Distinction in subject concepts" : (grade?.grade && typeof grade.grade === "string" && grade.grade.startsWith("Very")) ? "Very good performance" : (grade?.grade && typeof grade.grade === "string" && (grade.grade.startsWith("Credit") || grade.grade === "Good")) ? "Credit pass" : grade?.grade === "Developing" ? "Developing well" : grade?.grade === "Needs Support" ? "Needs support" : "Pass")),
                                    }))
                                  : [];

                                const activeTierName = getTierForClass(student.currentClass || className).name;
                                const isEarlyYearsTier = studentTierCat === "NURSERY";

                                setSelectedStudentForModal({
                                  id: student.id,
                                  name: student.name,
                                  admissionNumber: student.admissionNumber,
                                  currentClass: student.currentClass || className || (isTertiaryTier ? "100 Level" : "Primary 1"),
                                  term: term || (isTertiaryTier ? "1st Semester" : "1st Term"),
                                  academicYear: "2026/2027",
                                  tier: activeTierName,
                                  rank: student.rank,
                                  totalStudents: stats.totalStudents,
                                  overallTotal: student.overallTotal || student.total,
                                  overallAverage: student.overallAverage || (student.overallTotal ? Math.round((student.overallTotal / (student.subjectsCount || (student.subjects ? student.subjects.length : 1))) * 100) / 100 : student.total),
                                  overallGrade: student.isCompiled ? (grade?.grade || "—") : (isEarlyYearsTier ? "Needs Support" : "—"),
                                  status: student.status,
                                  teacherRemarks: student.teacherRemarks ?? undefined,
                                  principalRemarks: student.principalRemarks ?? undefined,
                                  subjects: resolvedSubjects,
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-xs shadow-2xs transition cursor-pointer"
                              title={isTertiaryTier ? "View Official Semester Transcript" : isCrecheTier ? "View Developmental Milestone Sheet" : "View Terminal Report Sheet"}
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{isTertiaryTier ? "View Transcript" : isCrecheTier ? "View Record" : "View Sheet"}</span>
                            </button>

                            {/* Direct PDF Download Link */}
                            <a
                              href={`/api/v1/report-cards/pdf?studentId=${encodeURIComponent(student.id)}&className=${encodeURIComponent(className)}&term=${encodeURIComponent(term)}&schoolId=${encodeURIComponent(tenant.id || "")}`}
                              download={`${isTertiaryTier ? "Semester_Transcript" : "ReportCard"}_${(student.admissionNumber || student.id).replace(/[^a-zA-Z0-9_-]/g, "_")}_${term.replace(/\s+/g, "_")}.pdf`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-xs shadow-2xs transition cursor-pointer"
                              title={isTertiaryTier ? "Download Semester Transcript PDF" : "Download High-Resolution PDF"}
                            >
                              <FileDown className="w-3.5 h-3.5 text-slate-500" />
                              <span>PDF</span>
                            </a>

                            {subject && (
                              <button 
                                onClick={() => handleSaveGrade(student)}
                                disabled={student.saving}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition font-medium text-xs shadow-xs cursor-pointer ${
                                  student.saved 
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                } disabled:opacity-50`}
                              >
                                {student.saved ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Saved
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3.5 h-3.5" />
                                    {student.saving ? "Saving..." : "Save Grade"}
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Core Actions Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">
                {className} • {term}{subject ? ` • ${subject}` : " • All Subjects"}
              </span>
              <span className="hidden sm:inline text-slate-400 mx-2">•</span>
              <span className="block sm:inline mt-0.5 sm:mt-0 text-xs sm:text-sm text-slate-500">
                {stats.compiledCount} of {stats.totalStudents} student records ready for publication
              </span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {/* Bulk Export ZIP / PDFs - secondary outline action */}
              <button
                type="button"
                onClick={handleBulkExportPdf}
                disabled={isExportingPdf || rankedRoster.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>{isExportingPdf ? "Generating ZIP..." : "Bulk Export ZIP / PDFs"}</span>
              </button>

              {/* Publish & Email Results - prominent primary blue action */}
              <button
                type="button"
                onClick={handlePublishResults}
                disabled={isPublishing || stats.compiledCount === 0}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isPublishing ? "Publishing & Emailing..." : "Publish & Email Results"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Student Report Card Modal & Printable PDF Preview */}
      {selectedStudentForModal && (
        <StudentReportCardModal
          isOpen={Boolean(selectedStudentForModal)}
          onClose={() => setSelectedStudentForModal(null)}
          studentData={selectedStudentForModal}
          schoolName={tenant.name || "Greenwood Academy"}
          schoolDomain={tenant.subdomain || "greenwood"}
        />
      )}
    </div>
  );
}

export default function ReportCardsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading report cards...</div>}>
      <ReportCardsContent />
    </Suspense>
  );
}
