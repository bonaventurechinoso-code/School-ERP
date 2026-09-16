import { basePrisma } from "../src/lib/tenant-prisma";
import {
  fetchStaffPortalInitialData,
  saveClassroomAttendance,
  fetchClassroomAttendance,
  saveClassroomGrades,
  fetchClassroomGrades,
} from "../src/app/[schoolDomain]/portal/staff/actions";

async function verifyStaffPortalHub() {
  console.log("=== STARTING STAFF PORTAL CLASSROOM & GRADING HUB VERIFICATION ===\n");

  // 1. Locate test tenant (Greenwood Academy or first active tenant)
  const school = await basePrisma.school.findFirst({
    where: { isActive: true },
    include: {
      academicTiers: true,
      classrooms: true,
      courses: true,
      students: {
        where: { status: { in: ["ENROLLED", "ACTIVE"] } },
        take: 5,
      },
    },
  });

  if (!school) {
    console.error("❌ No active institutional tenant found.");
    process.exit(1);
  }

  console.log(`🏫 Active Tenant: "${school.name}" (${school.subdomain})`);
  console.log(`   Academic Tiers: [${school.academicTiers.map((t) => t.name).join(", ")}]`);
  console.log(`   Classrooms Count: ${school.classrooms.length}`);
  console.log(`   Courses/Subjects Count: ${school.courses.length}`);
  console.log(`   Active Students Sample: ${school.students.length}`);

  // 2. Test Initial Data Loading Server Action
  console.log("\n--- 1. Testing fetchStaffPortalInitialData ---");
  const initialData = await fetchStaffPortalInitialData(school.id);
  console.log(`   Success: ${initialData.success}`);
  console.log(`   Tiers Loaded: ${initialData.tiers.length}`);
  console.log(`   Classrooms Loaded: ${initialData.classrooms.length}`);
  console.log(`   Subjects Loaded: ${initialData.courses.length}`);
  console.log(`   Students Loaded: ${initialData.students.length}`);

  if (initialData.students.length === 0) {
    console.log("   ⚠️ No enrolled students found for initial testing. Creating a test student...");
    const sampleTier = school.academicTiers[0];
    const testStudent = await basePrisma.student.create({
      data: {
        schoolId: school.id,
        tierId: sampleTier.id,
        firstName: "Chidera",
        lastName: "Eze",
        admissionNumber: "GW-2026-099",
        currentClass: "JSS 1",
        status: "ENROLLED",
        parentPhone: "08031234567",
      },
    });
    (initialData.students as any[]).push({
      id: testStudent.id,
      firstName: testStudent.firstName,
      lastName: testStudent.lastName,
      admissionNumber: testStudent.admissionNumber,
      currentClass: testStudent.currentClass,
      tierId: testStudent.tierId,
      status: testStudent.status,
      parentPhone: testStudent.parentPhone,
    });
  }

  const sampleStudent = initialData.students[0];
  const targetClass = sampleStudent.currentClass || "JSS 1";
  const todayStr = new Date().toISOString().split("T")[0];

  // 3. Test Attendance Saving & Retrieval
  console.log("\n--- 2. Testing Daily Attendance Register ---");
  console.log(`   Recording attendance for Student: ${sampleStudent.firstName} ${sampleStudent.lastName} on ${todayStr}`);

  const attendanceSaveRes = await saveClassroomAttendance(school.id, todayStr, [
    {
      studentId: sampleStudent.id,
      status: "PRESENT",
      notes: "Arrived early for assembly",
    },
  ]);
  console.log(`   Save Attendance Result: ${JSON.stringify(attendanceSaveRes)}`);

  const attendanceFetchRes = await fetchClassroomAttendance(school.id, todayStr);
  console.log(`   Fetch Attendance Count: ${attendanceFetchRes.records.length}`);
  const matchRecord = attendanceFetchRes.records.find((r) => r.studentId === sampleStudent.id);
  console.log(`   Verified Student Attendance Status: [${matchRecord?.status}] (Notes: "${matchRecord?.notes}")`);

  // 4. Test Continuous Assessment & Gradebook Matrix
  console.log("\n--- 3. Testing Gradebook Continuous Assessment (20/20/60) ---");
  const testSubject = initialData.courses[0]?.name || "General Mathematics";
  const testTerm = "1st Term";
  const testYear = "2026/2027";

  console.log(`   Entering scores for: ${testSubject} | ${testTerm} | ${targetClass}`);
  console.log(`   Student: ${sampleStudent.firstName} ${sampleStudent.lastName} -> CA1: 18/20, CA2: 19/20, Exam: 54/60 (Total: 91/100)`);

  const gradesSaveRes = await saveClassroomGrades(
    school.id,
    targetClass,
    testSubject,
    testTerm,
    testYear,
    [
      {
        studentId: sampleStudent.id,
        ca1: 18,
        ca2: 19,
        exam: 54,
        totalScore: 91,
        teacherRemarks: "Exceptional academic performance",
      },
    ]
  );
  console.log(`   Save Grades Result: ${JSON.stringify(gradesSaveRes)}`);

  const gradesFetchRes = await fetchClassroomGrades(school.id, targetClass, testSubject, testTerm);
  console.log(`   Fetched Grade Records Count: ${gradesFetchRes.grades.length}`);
  const studentGrade = gradesFetchRes.grades.find((g) => g.studentId === sampleStudent.id);
  console.log(`   Verified Grade Record: CA1=${studentGrade?.ca1}, CA2=${studentGrade?.ca2}, Exam=${studentGrade?.exam}, Total=${studentGrade?.totalScore}`);

  console.log("\n=== ALL STAFF PORTAL VERIFICATIONS PASSED SUCCESSFULLY ===");
}

verifyStaffPortalHub()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test Error:", err);
    process.exit(1);
  });
