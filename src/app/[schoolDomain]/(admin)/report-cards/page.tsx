"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";
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
  ca1: string;
  ca2: string;
  exam: string;
  saving?: boolean;
  saved?: boolean;
  error?: string;
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

  const [isLoading, setIsLoading] = useState(false);
  const [roster, setRoster] = useState<StudentScore[]>([]);
  const hasFilters = Boolean(term && className && subject);

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
  };

  // Handle Senior Secondary sub-stream toggle
  const handleStreamChange = (stream: SeniorStreamKey) => {
    setSeniorStream(stream);
    setSubject(""); // Immediately clears previous subject
  };

  // Ensure subject is reset if it doesn't belong to the newly computed subject array
  useEffect(() => {
    if (subject && !activeSubjects.includes(subject)) {
      setSubject("");
    }
  }, [activeSubjects, subject]);

  // Fetch roster when all three required filters (term, class, subject) are selected
  useEffect(() => {
    if (hasFilters) {
      setIsLoading(true);
      fetch(
        `/api/v1/report-cards/roster?term=${encodeURIComponent(term)}&className=${encodeURIComponent(className)}&subject=${encodeURIComponent(subject)}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.roster) {
            setRoster(data.roster);
          }
        })
        .catch((err) => console.error("Failed to load roster", err))
        .finally(() => setIsLoading(false));
    } else {
      setRoster([]);
    }
  }, [term, className, subject, hasFilters]);

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
            <span className="text-xs text-slate-400 font-normal">|</span>
            <span className="text-xs text-slate-500 font-medium">Synced with Global Sidebar</span>
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
              onChange={(e) => setSubject(e.target.value)}
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
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-6 py-4 font-semibold">Student Name</th>
                  <th className="px-6 py-4 font-semibold">Continuous Assessment 1 (Max 20)</th>
                  <th className="px-6 py-4 font-semibold">Continuous Assessment 2 (Max 20)</th>
                  <th className="px-6 py-4 font-semibold">
                    {isTertiaryTier ? "Semester Exam Score (Max 60)" : "Termly Exam Score (Max 60)"}
                  </th>
                  <th className="px-6 py-4 font-semibold">Total Score</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((student) => {
                  const ca1Num = Number(student.ca1) || 0;
                  const ca2Num = Number(student.ca2) || 0;
                  const examNum = Number(student.exam) || 0;
                  const total = ca1Num + ca2Num + examNum;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {student.name}
                        {student.error && (
                          <span className="block text-xs text-red-500 mt-0.5">{student.error}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="20" 
                          min="0"
                          value={student.ca1}
                          onChange={(e) => handleScoreChange(student.id, "ca1", e.target.value)}
                          className="w-24 border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="0 - 20"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="20" 
                          min="0"
                          value={student.ca2}
                          onChange={(e) => handleScoreChange(student.id, "ca2", e.target.value)}
                          className="w-24 border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="0 - 20"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="60" 
                          min="0"
                          value={student.exam}
                          onChange={(e) => handleScoreChange(student.id, "exam", e.target.value)}
                          className="w-24 border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 outline-none" 
                          placeholder="0 - 60"
                        />
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {total > 0 ? `${total}%` : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleSaveGrade(student)}
                          disabled={student.saving}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg transition font-medium text-xs shadow-sm ${
                            student.saved 
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          } disabled:opacity-50`}
                        >
                          {student.saved ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Saved
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
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
