export type InstitutionalTierType =
  | "NURSERY"
  | "PRIMARY"
  | "SECONDARY"
  | "PRIMARY_SECONDARY"
  | "POLYTECHNIC"
  | "COLLEGE_OF_EDUCATION"
  | "UNIVERSITY";

export interface TierTerminology {
  tierType: InstitutionalTierType;
  isCreche: boolean;
  isPrimary: boolean;
  isSecondary: boolean;
  isTertiary: boolean;

  // Exact institutional naming
  institutionCategory: string;
  workspaceTitle: string; // e.g. "School Workspace" vs "Campus Workspace" vs "Early Care & Learning"
  studentNoun: string; // "Pupil" vs "Student" vs "Child"
  studentsNoun: string; // "Pupils" vs "Students" vs "Children"
  teacherNoun: string; // "Class Teacher" vs "Subject Teacher" vs "Caregiver" vs "Lecturer"
  teachersNoun: string; // "Teachers" vs "Caregivers" vs "Faculty"
  headNoun: string; // "Headmaster" vs "Principal" vs "Lead Caregiver" vs "Vice Chancellor / Dean"
  academicPeriodNoun: string; // "Term" vs "Semester"
  currentPeriodLabel: string; // "Current Term" vs "Current Semester"
  periodOrdinal: (n?: number) => string; // "1st Term" vs "1st Semester"
  classroomNoun: string; // "Class" vs "Care Pod" vs "Lecture Hall"
  classroomsNoun: string; // "Classes" vs "Care Pods" vs "Courses / Units"
  regNumberNoun: string; // "Admission / Reg #" vs "Matric / Reg #" vs "Birth Reg / Tag #"
  classLevelLabel: string; // "Class / Stream" vs "Care Pod / Group" vs "Academic Level"
  curriculumEngineLabel: string;
  noticesTitle: string;
  noticesSubtitle: string;
  circularsTabTitle: string;
  circularsHeading: string;
  circularsSubheading: string;
  timetableLabel: string;
  lessonNotesLabel: string;
  reportCardLabel: string;
  behavioralRemarksLabel: string;
  staffDirectoryLabel: string;
  staffSearchPlaceholder: string;
  staffTableHead: string;
  authorizingBody: string;
  sampleNotice1Title: string;
  sampleNotice1Body: string;
  sampleNotice2Title: string;
  sampleNotice2Body: string;
}

export function resolveInstitutionalTier(
  schoolName: string = "",
  academicTiers: Array<{ name: string }> = [],
  explicitTier?: string
): TierTerminology {
  const nameUpper = (schoolName || "").toUpperCase();
  const tierNames = (academicTiers || []).map((t) => (t?.name || "").toUpperCase());

  let tierType: InstitutionalTierType = "PRIMARY";

  if (explicitTier) {
    const exp = explicitTier.toUpperCase();
    if (exp === "NURSERY" || exp === "CRECHE") tierType = "NURSERY";
    else if (exp === "SECONDARY") tierType = "SECONDARY";
    else if (exp === "PRIMARY_SECONDARY") tierType = "PRIMARY_SECONDARY";
    else if (exp === "POLYTECHNIC") tierType = "POLYTECHNIC";
    else if (exp === "COLLEGE_OF_EDUCATION") tierType = "COLLEGE_OF_EDUCATION";
    else if (exp === "UNIVERSITY") tierType = "UNIVERSITY";
    else if (exp === "PRIMARY") tierType = "PRIMARY";
  } else if (tierNames.length > 0) {
    if (tierNames.some((t) => t.includes("UNIVERSITY"))) {
      tierType = "UNIVERSITY";
    } else if (tierNames.some((t) => t.includes("POLYTECHNIC"))) {
      tierType = "POLYTECHNIC";
    } else if (tierNames.some((t) => t.includes("COLLEGE OF EDUCATION"))) {
      tierType = "COLLEGE_OF_EDUCATION";
    } else if (
      tierNames.some((t) => t.includes("PRIMARY") || t.includes("BASIC")) &&
      tierNames.some((t) => t.includes("SECONDARY") || t.includes("HIGH") || t.includes("COLLEGE"))
    ) {
      tierType = "PRIMARY_SECONDARY";
    } else if (tierNames.some((t) => t.includes("SECONDARY") || t.includes("HIGH") || (t.includes("COLLEGE") && !t.includes("EDUCATION")))) {
      tierType = "SECONDARY";
    } else if (tierNames.some((t) => t.includes("PRIMARY") || t.includes("BASIC") || t.includes("ELEMENTARY"))) {
      tierType = "PRIMARY";
    } else if (tierNames.some((t) => t.includes("NURSERY") || t.includes("CRECHE") || t.includes("EARLY"))) {
      tierType = "NURSERY";
    }
  } else {
    // Fallback based on school name
    if (nameUpper.includes("UNIVERSITY")) {
      tierType = "UNIVERSITY";
    } else if (nameUpper.includes("POLYTECHNIC")) {
      tierType = "POLYTECHNIC";
    } else if (nameUpper.includes("COLLEGE OF EDUCATION")) {
      tierType = "COLLEGE_OF_EDUCATION";
    } else if (nameUpper.includes("SECONDARY") || nameUpper.includes("HIGH SCHOOL") || nameUpper.includes("GRAMMAR")) {
      tierType = "SECONDARY";
    } else if (nameUpper.includes("PRIMARY") || nameUpper.includes("BASIC") || nameUpper.includes("ELEMENTARY")) {
      tierType = "PRIMARY";
    } else if (nameUpper.includes("NURSERY") || nameUpper.includes("CRECHE") || nameUpper.includes("KINDERGARTEN")) {
      tierType = "NURSERY";
    }
  }

  const isCreche = tierType === "NURSERY";
  const isPrimary = tierType === "PRIMARY" || tierType === "PRIMARY_SECONDARY";
  const isSecondary = tierType === "SECONDARY" || tierType === "PRIMARY_SECONDARY";
  const isTertiary = tierType === "UNIVERSITY" || tierType === "POLYTECHNIC" || tierType === "COLLEGE_OF_EDUCATION";

  if (isTertiary) {
    const instName =
      tierType === "UNIVERSITY"
        ? "University"
        : tierType === "POLYTECHNIC"
        ? "Polytechnic"
        : "College of Education";

    return {
      tierType,
      isCreche: false,
      isPrimary: false,
      isSecondary: false,
      isTertiary: true,
      institutionCategory: instName,
      workspaceTitle: "Campus Workspace",
      studentNoun: "Student",
      studentsNoun: "Students",
      teacherNoun: "Lecturer",
      teachersNoun: "Faculty",
      headNoun: tierType === "UNIVERSITY" ? "Vice Chancellor" : tierType === "POLYTECHNIC" ? "Rector" : "Provost",
      academicPeriodNoun: "Semester",
      currentPeriodLabel: "Current Semester",
      periodOrdinal: (n = 1) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : "rd"} Semester`,
      classroomNoun: "Course Unit / Lecture Hall",
      classroomsNoun: "Lecture Halls & Units",
      regNumberNoun: "Matric / Reg #",
      classLevelLabel: "Academic Level",
      curriculumEngineLabel: "Grading Engine: University Semester Examination System",
      noticesTitle: "Campus Notices",
      noticesSubtitle: "Official announcements, academic calendars, and campus administrative updates.",
      circularsTabTitle: "Departmental Circulars & Senate Resolutions",
      circularsHeading: "Departmental Circulars & Senate Resolutions",
      circularsSubheading: "Official faculty memos, academic board decisions, moderation directives, and institutional guidelines.",
      timetableLabel: "Lecture Timetables",
      lessonNotesLabel: "Course Outline & Syllabi",
      reportCardLabel: "Semester Result Transcripts",
      behavioralRemarksLabel: "Faculty Academic Remarks",
      staffDirectoryLabel: "Faculty & Staff Directory",
      staffSearchPlaceholder: "Search faculty by name, department, or email...",
      staffTableHead: "Faculty Member",
      authorizingBody: "Academic Senate & Registry",
      sampleNotice1Title: "Senate Directives on Mid-Semester Continuous Assessment Score Uploads",
      sampleNotice1Body: "All faculty members and course lecturers are instructed to conclude continuous assessments (CA1 & CA2) and lock student portal grades on or before Friday, November 14th.",
      sampleNotice2Title: "Statutory Faculty Board Meeting & Question Moderation",
      sampleNotice2Body: "The statutory semester meeting for external examiner appointments and courseware syllabus moderation is scheduled for the Faculty Board Room.",
    };
  }

  if (isCreche) {
    return {
      tierType: "NURSERY",
      isCreche: true,
      isPrimary: false,
      isSecondary: false,
      isTertiary: false,
      institutionCategory: "Creche & Nursery",
      workspaceTitle: "Early Care & Learning",
      studentNoun: "Child",
      studentsNoun: "Children",
      teacherNoun: "Caregiver",
      teachersNoun: "Caregivers",
      headNoun: "Head of Early Years",
      academicPeriodNoun: "Term",
      currentPeriodLabel: "Academic Term",
      periodOrdinal: (n = 1) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : "rd"} Term Care`,
      classroomNoun: "Care Pod / Playgroup",
      classroomsNoun: "Care Pods",
      regNumberNoun: "Birth Reg / Tag #",
      classLevelLabel: "Care Pod / Group",
      curriculumEngineLabel: "Milestone Tracking Engine: Early Childhood Development & Pediatric Growth Standards",
      noticesTitle: "Early Care Notices",
      noticesSubtitle: "Parent announcements, care schedules, and early childhood activity updates.",
      circularsTabTitle: "Parent Circulars & Creche Bulletins",
      circularsHeading: "Parent Circulars & Creche Bulletins",
      circularsSubheading: "Pediatric health guidance, nursery activities, hygiene protocols, and early years caregiver memos.",
      timetableLabel: "Daily Activity Logs (Feeding / Nap Schedules)",
      lessonNotesLabel: "Immunization & Health Vitals",
      reportCardLabel: "Child Growth Trackers (Milestones)",
      behavioralRemarksLabel: "Caregiver Developmental Observations",
      staffDirectoryLabel: "Caregivers & Staff Directory",
      staffSearchPlaceholder: "Search caregivers by name or email...",
      staffTableHead: "Caregiver",
      authorizingBody: "Early Years Directorate & Nursery Management",
      sampleNotice1Title: "Pediatric Health & Immunization Review Exercise",
      sampleNotice1Body: "All classroom caregivers and nursery minders must log weekly infant developmental checklists before the upcoming parent-caregiver conference.",
      sampleNotice2Title: "Monthly Montessori Sensory Toy Sterilization Protocol",
      sampleNotice2Body: "In compliance with early childhood hygiene standards, all nursery playrooms and day-rest cribs will undergo routine sanitization this weekend.",
    };
  }

  if (tierType === "SECONDARY") {
    return {
      tierType: "SECONDARY",
      isCreche: false,
      isPrimary: false,
      isSecondary: true,
      isTertiary: false,
      institutionCategory: "Secondary School",
      workspaceTitle: "School Workspace",
      studentNoun: "Student",
      studentsNoun: "Students",
      teacherNoun: "Subject Teacher",
      teachersNoun: "Teachers",
      headNoun: "Principal",
      academicPeriodNoun: "Term",
      currentPeriodLabel: "Current Term",
      periodOrdinal: (n = 1) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : "rd"} Term`,
      classroomNoun: "Classroom",
      classroomsNoun: "Classrooms & Streams",
      regNumberNoun: "Admission / Reg #",
      classLevelLabel: "Class / Stream",
      curriculumEngineLabel: "Grading Engine: WAEC / NECO Secondary Standard Continuous Assessment",
      noticesTitle: "School Notices",
      noticesSubtitle: "Official school announcements, academic calendars, and administrative directives.",
      circularsTabTitle: "Staff Circulars & Management Directives",
      circularsHeading: "Staff Circulars & Principal's Directives",
      circularsSubheading: "Official teaching staff circulars, examination moderation notices, and term academic guidelines.",
      timetableLabel: "Teaching & Class Schedule",
      lessonNotesLabel: "Lesson Notes & Schemes of Work",
      reportCardLabel: "Termly Report Cards",
      behavioralRemarksLabel: "Teacher Behavioral Remarks",
      staffDirectoryLabel: "Teaching & Administrative Staff Directory",
      staffSearchPlaceholder: "Search teachers by name, subject, or email...",
      staffTableHead: "Staff Member / Teacher",
      authorizingBody: "Office of the Principal & Academic Board",
      sampleNotice1Title: "Term Continuous Assessment (CA) Submission Deadline",
      sampleNotice1Body: "All subject teachers and form masters are instructed to compile continuous assessments (CA1 & CA2) and lock student portal grades before term examinations.",
      sampleNotice2Title: "Staff Academic Briefing & Examination Preparation",
      sampleNotice2Body: "The statutory staff academic briefing for term examination invigilation and question paper submission is scheduled for the Staff Common Room.",
    };
  }

  // PRIMARY or PRIMARY_SECONDARY (e.g. Egede Primary School)
  return {
    tierType: tierType === "PRIMARY_SECONDARY" ? "PRIMARY_SECONDARY" : "PRIMARY",
    isCreche: false,
    isPrimary: true,
    isSecondary: tierType === "PRIMARY_SECONDARY",
    isTertiary: false,
    institutionCategory: tierType === "PRIMARY_SECONDARY" ? "Primary & Secondary School" : "Primary School",
    workspaceTitle: "School Workspace",
    studentNoun: "Pupil",
    studentsNoun: "Pupils",
    teacherNoun: "Class Teacher",
    teachersNoun: "Teachers",
    headNoun: "Headmaster / Headmistress",
    academicPeriodNoun: "Term",
    currentPeriodLabel: "Current Term",
    periodOrdinal: (n = 1) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : "rd"} Term`,
    classroomNoun: "Class",
    classroomsNoun: "Classes (Basic 1 - 6)",
    regNumberNoun: "Admission / Reg #",
    classLevelLabel: "Class / Section",
    curriculumEngineLabel: "Grading Engine: NERDC 20/20/60 Standard Continuous Assessment",
    noticesTitle: "School Notices",
    noticesSubtitle: "Official announcements, academic calendars, and school administrative updates.",
    circularsTabTitle: "Staff Circulars & School Directives",
    circularsHeading: "Staff Circulars & Headmaster's Directives",
    circularsSubheading: "Official teachers memos, basic curriculum directives, and school administrative guidelines.",
    timetableLabel: "Class Timetable",
    lessonNotesLabel: "Lesson Notes & Schemes of Work",
    reportCardLabel: "Termly Report Cards",
    behavioralRemarksLabel: "Teacher Behavioral Remarks",
    staffDirectoryLabel: "Teaching & School Staff Directory",
    staffSearchPlaceholder: "Search teachers by name, class, or email...",
    staffTableHead: "Teacher / Staff Member",
    authorizingBody: "Office of the Headmaster & School Administration",
    sampleNotice1Title: "Term Continuous Assessment (CA) Score Compilation",
    sampleNotice1Body: "All primary class teachers and subject instructors are reminded to conclude continuous assessments (CA1 & CA2) and submit pupil scores before the term deadline.",
    sampleNotice2Title: "Staff Meeting & Foundational Curriculum Review",
    sampleNotice2Body: "The general teachers meeting with the Headmaster to review basic literacy and numeracy milestones will take place in the School Staff Room.",
  };
}
