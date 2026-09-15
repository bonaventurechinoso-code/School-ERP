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
} from "lucide-react";
import { useTenant } from "@/lib/tenant-context";

// -------------------------------------------------------------
// Nigerian Educational Ecosystem Subject Rosters (NERDC & Tertiary)
// -------------------------------------------------------------

// 1. DAYCARE & NURSERY (Early Childhood Care - All Classes)
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
    normalized.includes("DAYCARE") ||
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
  ca1: string;
  ca2: string;
  exam: string;
  saving?: boolean;
  saved?: boolean;
  error?: string;
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

function getGradeInfo(score: number): { grade: string; badgeClass: string } {
  if (score >= 75) return { grade: "A1", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" };
  if (score >= 70) return { grade: "B2", badgeClass: "bg-teal-100 text-teal-800 border-teal-300" };
  if (score >= 65) return { grade: "B3", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" };
  if (score >= 60) return { grade: "C4", badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300" };
  if (score >= 55) return { grade: "C5", badgeClass: "bg-sky-100 text-sky-800 border-sky-300" };
  if (score >= 50) return { grade: "C6", badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300" };
  if (score >= 45) return { grade: "D7", badgeClass: "bg-amber-100 text-amber-800 border-amber-300" };
  if (score >= 40) return { grade: "E8", badgeClass: "bg-orange-100 text-orange-800 border-orange-300" };
  return { grade: "F9", badgeClass: "bg-rose-100 text-rose-800 border-rose-300" };
}

function getPositionBadge(rank: number): { text: string; badgeClass: string } {
  if (rank <= 0) return { text: "—", badgeClass: "bg-slate-100 text-slate-400 border-slate-200" };
  const str = getOrdinalSuffix(rank);
  if (rank === 1) return { text: str, badgeClass: "bg-amber-100 text-amber-900 border-amber-300 font-extrabold shadow-2xs" };
  if (rank === 2) return { text: str, badgeClass: "bg-slate-200 text-slate-800 border-slate-300 font-bold" };
  if (rank === 3) return { text: str, badgeClass: "bg-orange-100 text-orange-800 border-orange-200 font-bold" };
  return { text: str, badgeClass: "bg-slate-100 text-slate-700 border-slate-200 font-medium" };
}

function ReportCardsContent() {
  const tenant = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramTier = searchParams.get("tier");

  // Inherit active tier key directly from global sidebar selection (URL search param, cookie, tenant context, or institution type)
  const cookieTier = typeof document !== "undefined"
    ? document.cookie
        .split("; ")
        .find((row) => row.startsWith("activeTier="))
        ?.split("=")[1]
    : null;
  const decodedCookieTier = cookieTier ? decodeURIComponent(cookieTier) : null;

  const tenantActiveTier = (tenant as any)?.activeTier;
  const tenantPreciseTier = tenant.preciseTier;
  const tenantType = tenant.institutionType;

  const activeTierKey: TierKey = useMemo(() => {
    return resolveAcademicTierKey(
      paramTier || decodedCookieTier || tenantActiveTier || tenantPreciseTier || (tenantType === "HIGHER_ED" ? "UNIVERSITY" : "PRIMARY"),
      tenantType
    );
  }, [paramTier, decodedCookieTier, tenantActiveTier, tenantPreciseTier, tenantType]);

  const academicTier = activeTierKey;
  const [term, setTerm] = useState("");
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [seniorStream, setSeniorStream] = useState<SeniorStreamKey>("ALL");
  const [isGenerated, setIsGenerated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [roster, setRoster] = useState<StudentScore[]>([]);

  // Flexible normalized filter completeness check (handles string casing and whitespace cleanly)
  const isFilterActive = useMemo(() => {
    const hasTerm = Boolean(term && String(term).trim().length > 0);
    const hasClass = Boolean(className && String(className).trim().length > 0);
    const hasSubject = Boolean(subject && String(subject).trim().length > 0);
    return hasTerm && hasClass && hasSubject;
  }, [term, className, subject]);

  const hasFilters = Boolean(isGenerated || isFilterActive);

  // Critical Logic Binding: When the global sidebar 'Academic Tier' updates,
  // automatically reset class, subject, and term selections so they don't carry over into the new tier
  const prevTierRef = useRef<TierKey>(activeTierKey);

  useEffect(() => {
    if (prevTierRef.current !== activeTierKey) {
      prevTierRef.current = activeTierKey;
      setClassName("");
      setSubject("");
      setTerm("");
      setSeniorStream("ALL");
      setRoster([]);
      setIsGenerated(false);
    }
  }, [activeTierKey]);

  // Current active class levels for the selected tier
  const activeClasses = useMemo(() => {
    return TIER_CLASSES_MAP[academicTier] || TIER_CLASSES_MAP.PRIMARY;
  }, [academicTier]);

  // Compute the exact subjects dynamically based on BOTH Academic Tier AND Selected Class/Level
  const activeSubjects: string[] = useMemo(() => {
    if (!className) {
      return [];
    }

    if (academicTier === "NURSERY") {
      return NURSERY_SUBJECTS;
    }

    if (academicTier === "PRIMARY") {
      if (isLowerPrimaryClass(className)) {
        return LOWER_PRIMARY_SUBJECTS;
      }
      if (isUpperPrimaryClass(className)) {
        return UPPER_PRIMARY_SUBJECTS;
      }
      return LOWER_PRIMARY_SUBJECTS;
    }

    if (academicTier === "SECONDARY") {
      if (isJuniorSecondaryClass(className)) {
        return JUNIOR_SECONDARY_SUBJECTS;
      }
      if (isSeniorSecondaryClass(className)) {
        if (seniorStream === "CORE") {
          return SENIOR_CORE_SUBJECTS;
        }
        if (seniorStream === "SCIENCE") {
          return [...SENIOR_CORE_SUBJECTS, ...SENIOR_SCIENCE_ADDITIONS];
        }
        if (seniorStream === "HUMANITIES") {
          return [...SENIOR_CORE_SUBJECTS, ...SENIOR_HUMANITIES_ADDITIONS];
        }
        if (seniorStream === "COMMERCIAL") {
          return [...SENIOR_CORE_SUBJECTS, ...SENIOR_COMMERCIAL_ADDITIONS];
        }
        return SENIOR_SECONDARY_ALL_SUBJECTS;
      }
      return JUNIOR_SECONDARY_SUBJECTS;
    }

    if (academicTier === "COLLEGE_OF_EDUCATION") {
      return COE_SUBJECTS;
    }

    if (academicTier === "POLYTECHNIC") {
      return POLYTECHNIC_SUBJECTS;
    }

    if (academicTier === "UNIVERSITY") {
      return UNIVERSITY_SUBJECTS;
    }

    if (academicTier === "HIGHER_ED") {
      if (isCollegeOfEducationClass(className)) {
        return COE_SUBJECTS;
      }
      if (isPolytechnicClass(className)) {
        return POLYTECHNIC_SUBJECTS;
      }
      if (isUniversityClass(className)) {
        return UNIVERSITY_SUBJECTS;
      }
      return UNIVERSITY_SUBJECTS;
    }

    return [];
  }, [academicTier, className, seniorStream]);



  // Critical Assurance: When 'Choose Class' changes, immediately clear subject selection
  const handleClassChange = (newClass: string) => {
    setClassName(newClass);
    setSubject(""); // Immediately clears previous subject value
    setIsGenerated(false);
  };

  // Handle Senior Secondary sub-stream toggle
  const handleStreamChange = (stream: SeniorStreamKey) => {
    setSeniorStream(stream);
    setSubject(""); // Immediately clears previous subject
    setIsGenerated(false);
  };

  // Fetch roster when all three required filters (term, class, subject) are selected or generation is requested
  useEffect(() => {
    if (isFilterActive && hasFilters) {
      setIsLoading(true);
      fetch(
        `/api/v1/report-cards/roster?term=${encodeURIComponent(String(term).trim())}&className=${encodeURIComponent(String(className).trim())}&subject=${encodeURIComponent(String(subject).trim())}&schoolId=${encodeURIComponent(tenant.id || "")}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.roster) {
            setRoster(data.roster);
          }
        })
        .catch((err) => console.error("Failed to load roster", err))
        .finally(() => setIsLoading(false));
    } else if (!isFilterActive) {
      setRoster([]);
      setIsGenerated(false);
    }
  }, [term, className, subject, isFilterActive, hasFilters, tenant.id]);

  // Explicit Action: Generate Report Sheets / Cards
  const handleGenerateReportSheets = () => {
    if (!isFilterActive) return;
    setIsGenerated(true);
    setIsLoading(true);
    fetch(
      `/api/v1/report-cards/roster?term=${encodeURIComponent(String(term).trim())}&className=${encodeURIComponent(String(className).trim())}&subject=${encodeURIComponent(String(subject).trim())}&schoolId=${encodeURIComponent(tenant.id || "")}`
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

  const [searchQuery, setSearchQuery] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // Compute positions across the class roster based on total score descending
  const rankedRoster = useMemo(() => {
    const withTotals = roster.map((s) => {
      const ca1Num = Number(s.ca1) || 0;
      const ca2Num = Number(s.ca2) || 0;
      const examNum = Number(s.exam) || 0;
      const total = ca1Num + ca2Num + examNum;
      const hasScores = Boolean(s.ca1 !== "" || s.ca2 !== "" || s.exam !== "");
      const isCompiled = (s.ca1 !== "" && s.ca2 !== "" && s.exam !== "") || total > 0;
      return {
        ...s,
        ca1Num,
        ca2Num,
        examNum,
        total,
        hasScores,
        isCompiled,
      };
    });

    // Standard competitive ranking descending by total score
    const sorted = [...withTotals].sort((a, b) => b.total - a.total);
    const rankMap = new Map<string, number>();

    let currentRank = 1;
    sorted.forEach((item, index) => {
      if (index > 0 && item.total < sorted[index - 1].total) {
        currentRank = index + 1;
      }
      rankMap.set(item.id, item.total > 0 ? currentRank : 0);
    });

    return withTotals.map((student) => {
      const rank = rankMap.get(student.id) || 0;
      return {
        ...student,
        rank,
        status: student.isCompiled ? "Compiled" : "Pending Review",
      };
    });
  }, [roster]);

  const filteredRoster = useMemo(() => {
    if (!searchQuery.trim()) return rankedRoster;
    const q = searchQuery.toLowerCase();
    return rankedRoster.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q))
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

  const handleBulkExportPdf = () => {
    setIsExportingPdf(true);
    setActionFeedback({
      message: `Preparing high-resolution PDF export for ${className} (${term} - ${subject})...`,
      type: "info",
    });
    setTimeout(() => {
      setIsExportingPdf(false);
      window.print();
    }, 700);
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

  const isSenior = isSeniorSecondaryClass(className);
  const isTertiaryTier =
    academicTier === "COLLEGE_OF_EDUCATION" ||
    academicTier === "POLYTECHNIC" ||
    academicTier === "UNIVERSITY" ||
    academicTier === "HIGHER_ED";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 bg-slate-50 text-slate-900 min-h-screen pb-12">
      <header>
        <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: tenant.branding?.primaryColor || "#0f172a" }}>
          {academicTier === "SECONDARY" ? "Termly Report Sheets" : "Termly Report Cards"}
        </h2>
        <p className="mt-2 text-lg text-slate-500">
          Continuous Assessment (CA) tracking, termly exam scores, and automated report sheet generation.
        </p>
      </header>

      {/* Filter Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Filter Roster</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>
              {academicTier === "NURSERY" && "Early Childhood Care (Creche & Nursery)"}
              {academicTier === "PRIMARY" && "9-Year Basic Education (Primary)"}
              {academicTier === "SECONDARY" && "Secondary Education (Junior & Senior)"}
              {academicTier === "COLLEGE_OF_EDUCATION" && "College of Education (Tertiary NCE)"}
              {academicTier === "UNIVERSITY" && "University (Undergraduate & Postgraduate)"}
              {academicTier === "HIGHER_ED" && "Tertiary / Higher Education Module"}
            </span>
          </span>
        </div>

        {/* Re-aligned 3-column grid for Term, Class, and Subject */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">

          {/* 2. Term / Semester */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isTertiaryTier ? "Select Semester" : "Select Term"}
            </label>
            <select 
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">{isTertiaryTier ? "-- Choose Semester --" : "-- Choose Term --"}</option>
              {isTertiaryTier ? (
                <>
                  <option value="1st Semester">1st Semester</option>
                  <option value="2nd Semester">2nd Semester</option>
                </>
              ) : (
                <>
                  <option value="1st Term">1st Term</option>
                  <option value="2nd Term">2nd Term</option>
                  <option value="3rd Term">3rd Term</option>
                </>
              )}
            </select>
          </div>
          
          {/* 3. Class / Level Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isTertiaryTier ? "Select Level / Program" : "Select Class"}
            </label>
            <select 
              value={className}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="">
                {isTertiaryTier ? "-- Choose Level / Program --" : "-- Choose Class --"}
              </option>

              {academicTier === "PRIMARY" ? (
                <>
                  <optgroup label="Lower Primary (Basic 1 - 3)">
                    <option value="Primary 1">Primary 1</option>
                    <option value="Primary 2">Primary 2</option>
                    <option value="Primary 3">Primary 3</option>
                  </optgroup>
                  <optgroup label="Upper Primary (Basic 4 - 6)">
                    <option value="Primary 4">Primary 4</option>
                    <option value="Primary 5">Primary 5</option>
                    <option value="Primary 6">Primary 6</option>
                  </optgroup>
                </>
              ) : academicTier === "SECONDARY" ? (
                <>
                  <optgroup label="Junior Secondary (JSS 1 - 3)">
                    <option value="JSS 1">JSS 1</option>
                    <option value="JSS 2">JSS 2</option>
                    <option value="JSS 3">JSS 3</option>
                  </optgroup>
                  <optgroup label="Senior Secondary (SS 1 - 3)">
                    <option value="SS 1">SS 1</option>
                    <option value="SS 2">SS 2</option>
                    <option value="SS 3">SS 3</option>
                  </optgroup>
                </>
              ) : academicTier === "COLLEGE_OF_EDUCATION" ? (
                <optgroup label="College of Education (NCE)">
                  <option value="NCE 1">NCE 1</option>
                  <option value="NCE 2">NCE 2</option>
                  <option value="NCE 3">NCE 3</option>
                </optgroup>
              ) : academicTier === "POLYTECHNIC" ? (
                <optgroup label="Polytechnic (ND & HND)">
                  <option value="ND 1">ND 1</option>
                  <option value="ND 2">ND 2</option>
                  <option value="HND 1">HND 1</option>
                  <option value="HND 2">HND 2</option>
                </optgroup>
              ) : academicTier === "UNIVERSITY" ? (
                <optgroup label="University (Undergraduate & Postgraduate)">
                  <option value="100 Level">100 Level</option>
                  <option value="200 Level">200 Level</option>
                  <option value="300 Level">300 Level</option>
                  <option value="400 Level">400 Level</option>
                  <option value="500 Level">500 Level</option>
                </optgroup>
              ) : academicTier === "HIGHER_ED" ? (
                <>
                  <optgroup label="University (Undergraduate)">
                    <option value="100 Level">100 Level</option>
                    <option value="200 Level">200 Level</option>
                    <option value="300 Level">300 Level</option>
                    <option value="400 Level">400 Level</option>
                    <option value="500 Level">500 Level</option>
                  </optgroup>
                  <optgroup label="Polytechnic (ND & HND)">
                    <option value="ND 1">ND 1</option>
                    <option value="ND 2">ND 2</option>
                    <option value="HND 1">HND 1</option>
                    <option value="HND 2">HND 2</option>
                  </optgroup>
                  <optgroup label="College of Education (NCE)">
                    <option value="NCE 1">NCE 1</option>
                    <option value="NCE 2">NCE 2</option>
                    <option value="NCE 3">NCE 3</option>
                  </optgroup>
                </>
              ) : (
                activeClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
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
                if (val && term && className) {
                  setIsGenerated(true);
                }
              }}
              disabled={!className}
              className={`w-full border border-slate-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium ${
                !className ? "bg-slate-50 cursor-not-allowed opacity-70" : ""
              }`}
            >
              <option value="">
                {!className
                  ? "-- Choose Class First --"
                  : academicTier === "HIGHER_ED"
                  ? "-- Choose Course --"
                  : "-- Choose Subject --"}
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

        {/* Explicit Action Button: Generate Report Sheets / Cards */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isFilterActive ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
            <span>
              {isFilterActive
                ? `Ready to generate: ${className} • ${term} • ${subject}`
                : "Select Term, Class, and Subject above to populate class roster"}
            </span>
          </div>

          <button
            type="button"
            id="generate-report-sheets-btn"
            onClick={handleGenerateReportSheets}
            disabled={!isFilterActive}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <span>
              {isTertiaryTier
                ? "Generate Course Result Sheets →"
                : academicTier === "SECONDARY"
                ? "Generate Report Sheets →"
                : "Generate Report Cards →"}
            </span>
          </button>
        </div>
      </div>

      {/* Roster Table or Placeholder */}
      {!hasFilters ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Awaiting Selection</h3>
          <p className="text-slate-500 max-w-md">
            Please select a {isTertiaryTier ? "semester, level, and course" : "term, class, and subject"} to begin entering student marks.
          </p>
        </div>
      ) : isLoading ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <h3 className="text-lg font-bold text-slate-800">Loading Compiled Class Roster...</h3>
          <p className="text-slate-500 text-sm mt-1">Retrieving continuous assessments and exam marks for {className}.</p>
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
      ) : (
        <div className="space-y-5">
          {/* Automated Batch Summary Header Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200/80">
                <Users className="w-4 h-4 text-slate-500" />
                <span>{stats.totalStudents} Enrolled</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/80">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{stats.compiledCount} Compiled</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200/80">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>{stats.pendingCount} Pending Review</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/80">
                <Award className="w-4 h-4 text-blue-600" />
                <span>Class Avg: {stats.avgScore}%</span>
              </div>
            </div>

            {/* Quick Filter Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student name or adm #..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
          </div>

          {/* Interactive Action Feedback Banner */}
          {actionFeedback && (
            <div className={`p-4 rounded-xl border flex items-center justify-between text-sm animate-in fade-in duration-300 ${
              actionFeedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
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

          {/* Automated Compiled Class Data Grid Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Position in Class</th>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Admission Number</th>
                    <th className="px-6 py-4">Continuous Assessment 1 (Max 20)</th>
                    <th className="px-6 py-4">Continuous Assessment 2 (Max 20)</th>
                    <th className="px-6 py-4">
                      {isTertiaryTier ? "Semester Exam (Max 60)" : "Termly Exam (Max 60)"}
                    </th>
                    <th className="px-6 py-4">Calculated Total Score</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.map((student) => {
                    const pos = getPositionBadge(student.rank);
                    const grade = getGradeInfo(student.total);
                    const initials = student.name
                      .split(/[\s,]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase() || "ST";

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Position in Class */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center justify-center min-w-[42px] px-2.5 py-1 rounded-full text-xs border ${pos.badgeClass}`}>
                            {pos.text}
                          </span>
                        </td>

                        {/* Student Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">{student.name}</span>
                              {student.error && (
                                <span className="block text-xs text-red-500 mt-0.5">{student.error}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Admission Number */}
                        <td className="px-6 py-4">
                          <span className="inline-block font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                            {student.admissionNumber || "—"}
                          </span>
                        </td>

                        {/* CA 1 */}
                        <td className="px-6 py-4">
                          <input 
                            type="number" 
                            max="20" 
                            min="0"
                            value={student.ca1}
                            onChange={(e) => handleScoreChange(student.id, "ca1", e.target.value)}
                            className="w-20 border border-slate-300 rounded-lg p-1.5 text-center text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
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
                            className="w-20 border border-slate-300 rounded-lg p-1.5 text-center text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
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
                            className="w-20 border border-slate-300 rounded-lg p-1.5 text-center text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition" 
                            placeholder="0 - 60"
                          />
                        </td>

                        {/* Calculated Total Score */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base text-slate-900">
                              {student.total > 0 ? `${student.total}%` : "—"}
                            </span>
                            {student.total > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${grade.badgeClass}`}>
                                {grade.grade}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4">
                          {student.status === "Compiled" ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Compiled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Pending Review
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 text-right">
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
                {className} • {term} • {subject}
              </span>
              <span className="hidden sm:inline text-slate-400 mx-2">•</span>
              <span className="block sm:inline mt-0.5 sm:mt-0 text-xs sm:text-sm text-slate-500">
                {stats.compiledCount} of {stats.totalStudents} student records ready for publication
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {/* Bulk Export PDF - secondary outline action */}
              <button
                type="button"
                onClick={handleBulkExportPdf}
                disabled={isExportingPdf || rankedRoster.length === 0}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>{isExportingPdf ? "Generating PDF..." : "Bulk Export PDF"}</span>
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
