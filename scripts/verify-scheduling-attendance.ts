import { basePrisma, getPrismaClientForTier } from "../src/lib/tenant-prisma";
import {
  createTimetableEntry,
  deleteTimetableEntry,
  markStudentAttendance,
  markStaffAttendance,
  markAllClassPresentAction
} from "../src/app/[schoolDomain]/(admin)/scheduling/actions";

async function verifySchedulingAndAttendance() {
  console.log("=================================================================");
  console.log("  VERIFYING SCHEDULING & ATTENDANCE: TIMETABLE & DAILY REGISTER  ");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Locate test tenant
    const school = await basePrisma.school.findFirst({
      where: { isActive: true },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
        classrooms: true,
        courses: true,
        staff: true,
        students: {
          where: { status: { in: ["ENROLLED", "ACTIVE"] } },
          take: 10,
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
    console.log(`   Courses Count: ${school.courses.length}`);
    console.log(`   Staff Count: ${school.staff.length}`);
    console.log(`   Sample Enrolled Students: ${school.students.length}\n`);

    const activeTier = school.academicTiers[0]?.name || "Primary School";
    const tenantDb = await getPrismaClientForTier(school.id, activeTier);

    // Ensure prerequisite data exists
    let course = school.courses[0];
    if (!course) {
      course = await tenantDb.course.create({
        data: {
          schoolId: school.id,
          name: "General Mathematics",
          code: "MTH101",
        }
      });
      console.log("   Created temporary test course: General Mathematics");
    }

    let classroom = school.classrooms[0];
    if (!classroom) {
      classroom = await tenantDb.classroom.create({
        data: {
          schoolId: school.id,
          name: "Basic 1",
          capacity: 35,
        }
      });
      console.log("   Created temporary test classroom: Basic 1");
    }

    let staffMember = school.staff[0];
    if (!staffMember) {
      staffMember = await tenantDb.staff.create({
        data: {
          schoolId: school.id,
          firstName: "Ade",
          lastName: "Okafor",
          email: "ade.okafor@test.edu.ng",
          role: "TEACHER",
          status: "ACTIVE",
        }
      });
      console.log("   Created temporary test faculty member: Ade Okafor");
    }

    // -------------------------------------------------------------
    // TEST 1: CREATE TIMETABLE SESSION ENTRY
    // -------------------------------------------------------------
    console.log("--- TEST 1: Create Timetable Entry ---");
    const sessionRes = await createTimetableEntry(
      school.id,
      {
        courseId: course.id,
        classroomId: classroom.id,
        staffId: staffMember.id,
        dayOfWeek: "MONDAY",
        startTime: "09:00",
        endTime: "10:00",
      },
      school.subdomain,
      activeTier
    );
    assert(sessionRes.success === true, "Timetable entry created successfully without conflict");

    // Fetch created timetable entry
    const createdSession = await tenantDb.timetable.findFirst({
      where: {
        schoolId: school.id,
        dayOfWeek: "MONDAY",
        startTime: "09:00",
        staffId: staffMember.id,
      }
    });
    assert(createdSession !== null, "Created timetable session persisted in isolated database");

    // -------------------------------------------------------------
    // TEST 2: TEACHER DOUBLE-BOOKING CLASH PREVENTION
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Teacher Double-Booking Clash Detection ---");
    const teacherConflictRes = await createTimetableEntry(
      school.id,
      {
        courseId: course.id,
        classroomId: classroom.id,
        staffId: staffMember.id, // Same teacher
        dayOfWeek: "MONDAY",     // Same day
        startTime: "09:30",     // Overlapping time
        endTime: "10:30",
      },
      school.subdomain,
      activeTier
    );
    assert(
      teacherConflictRes.success === false && (teacherConflictRes.error || "").includes("Teacher is already booked"),
      `Teacher conflict successfully caught: "${teacherConflictRes.error}"`
    );

    // -------------------------------------------------------------
    // TEST 3: ROOM DOUBLE-BOOKING CLASH PREVENTION
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Room Double-Booking Clash Detection ---");
    // Create a secondary faculty member to test room clash
    let secondStaff = school.staff[1];
    if (!secondStaff) {
      secondStaff = await tenantDb.staff.create({
        data: {
          schoolId: school.id,
          firstName: "Fatima",
          lastName: "Aliyu",
          email: "fatima.aliyu@test.edu.ng",
          role: "TEACHER",
          status: "ACTIVE",
        }
      });
    }

    const roomConflictRes = await createTimetableEntry(
      school.id,
      {
        courseId: course.id,
        classroomId: classroom.id, // Same classroom
        staffId: secondStaff.id,   // Different teacher
        dayOfWeek: "MONDAY",       // Same day
        startTime: "09:15",       // Overlapping time
        endTime: "10:15",
      },
      school.subdomain,
      activeTier
    );
    assert(
      roomConflictRes.success === false && (roomConflictRes.error || "").includes("Room is already booked"),
      `Room conflict successfully caught: "${roomConflictRes.error}"`
    );

    // Clean up created session
    if (createdSession) {
      await deleteTimetableEntry(school.id, createdSession.id, school.subdomain, activeTier);
      const deletedSession = await tenantDb.timetable.findUnique({ where: { id: createdSession.id } });
      assert(deletedSession === null, "Test timetable session cleaned up successfully");
    }

    // -------------------------------------------------------------
    // TEST 4: INDIVIDUAL STUDENT ATTENDANCE MARKING
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Student Attendance Marking ---");
    let student = school.students[0];
    if (!student) {
      student = await tenantDb.student.create({
        data: {
          schoolId: school.id,
          tierId: school.academicTiers[0].id,
          firstName: "Somto",
          lastName: "Okeke",
          admissionNumber: "TEST/2026/001",
          currentClass: classroom.name,
          status: "ENROLLED"
        }
      });
    }

    const todayDateStr = new Date().toISOString().split("T")[0];

    // Mark Present
    const markRes1 = await markStudentAttendance(
      school.id,
      student.id,
      todayDateStr,
      "PRESENT",
      "On time",
      school.subdomain,
      activeTier
    );
    assert(markRes1.success === true, "Marked student as PRESENT");

    // Update to Late
    const markRes2 = await markStudentAttendance(
      school.id,
      student.id,
      todayDateStr,
      "LATE",
      "Arrived 15 mins late",
      school.subdomain,
      activeTier
    );
    assert(markRes2.success === true, "Updated student attendance to LATE");

    const record = await tenantDb.studentAttendance.findFirst({
      where: { schoolId: school.id, studentId: student.id }
    });
    assert(record !== null && record.status === "LATE", "Student attendance record accurately updated in database");

    // -------------------------------------------------------------
    // TEST 5: BATCH MARK ALL CLASS PRESENT
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Batch Mark All Class Present ---");
    const targetClass = student.currentClass || classroom.name;
    const batchRes = await markAllClassPresentAction(
      school.id,
      targetClass,
      todayDateStr,
      school.subdomain,
      activeTier
    );
    assert(
      batchRes.success === true && typeof batchRes.count === "number" && batchRes.count >= 1,
      `Batch action succeeded, marked ${batchRes.count} student(s) Present in ${targetClass}`
    );

    const verifiedBatchRecord = await tenantDb.studentAttendance.findFirst({
      where: { schoolId: school.id, studentId: student.id }
    });
    assert(
      verifiedBatchRecord !== null && verifiedBatchRecord.status === "PRESENT",
      "Student successfully transitioned to PRESENT via batch roll call"
    );

    // -------------------------------------------------------------
    // TEST 6: FACULTY ATTENDANCE MARKING
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Staff Attendance Marking ---");
    const staffAttRes = await markStaffAttendance(
      school.id,
      staffMember.id,
      todayDateStr,
      "PRESENT",
      "Present for morning assembly",
      school.subdomain,
      activeTier
    );
    assert(staffAttRes.success === true, "Marked faculty member as PRESENT");

    const staffRecord = await tenantDb.staffAttendance.findFirst({
      where: { schoolId: school.id, staffId: staffMember.id }
    });
    assert(staffRecord !== null && staffRecord.status === "PRESENT", "Faculty attendance record verified in database");

    console.log("\n=================================================================");
    console.log(`  VERIFICATION SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log("=================================================================\n");

  } catch (error) {
    console.error("❌ Unexpected verification error:", error);
    process.exit(1);
  } finally {
    await basePrisma.$disconnect();
  }
}

verifySchedulingAndAttendance();
