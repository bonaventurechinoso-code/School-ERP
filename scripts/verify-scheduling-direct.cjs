const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function verifySchedulingDirect() {
  console.log("=================================================================");
  console.log("   DIRECT DATABASE VERIFICATION: TIMETABLE & ATTENDANCE REGISTER  ");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    const school = await prisma.school.findFirst({
      where: { subdomain: "greenwood" },
      include: {
        academicTiers: { orderBy: { level: "asc" } },
        classrooms: true,
        courses: true,
        staff: true,
        students: {
          where: { status: { in: ["ENROLLED", "ACTIVE"] } },
          take: 5
        }
      }
    });

    if (!school) {
      console.error("❌ Greenwood Academy not found.");
      process.exit(1);
    }

    console.log(`🏫 School: ${school.name} (${school.subdomain})`);
    console.log(`📚 Academic Tiers: ${school.academicTiers.map(t => t.name).join(", ")}`);
    console.log(`🚪 Classrooms: ${school.classrooms.length}`);
    console.log(`📖 Courses: ${school.courses.length}`);
    console.log(`👨‍🏫 Faculty: ${school.staff.length}\n`);

    const course = school.courses[0];
    const classroom = school.classrooms[0];
    const teacher = school.staff.find(s => s.role.includes("Teacher") || s.role === "TEACHER") || school.staff[0];

    // --- TEST 1: Timetable Creation & Persistence ---
    console.log("--- TEST 1: Timetable Creation & Unique Day/Time Slot ---");
    // Clean any prior test entry
    await prisma.timetable.deleteMany({
      where: {
        schoolId: school.id,
        dayOfWeek: "FRIDAY",
        startTime: "14:00"
      }
    });

    const session = await prisma.timetable.create({
      data: {
        schoolId: school.id,
        courseId: course.id,
        classroomId: classroom.id,
        staffId: teacher.id,
        dayOfWeek: "FRIDAY",
        startTime: "14:00",
        endTime: "15:00"
      }
    });
    assert(session.id !== undefined, "Class session scheduled and persisted with ID: " + session.id);

    // --- TEST 2: Teacher Double-Booking Detection Logic ---
    console.log("\n--- TEST 2: Teacher Double Booking Detection ---");
    const teacherConflict = await prisma.timetable.findFirst({
      where: {
        schoolId: school.id,
        staffId: teacher.id,
        dayOfWeek: "FRIDAY",
        startTime: { lt: "14:30" },
        endTime: { gt: "14:15" }
      }
    });
    assert(teacherConflict !== null && teacherConflict.id === session.id, "Teacher conflict correctly identified overlapping slot");

    // --- TEST 3: Room Double-Booking Detection Logic ---
    console.log("\n--- TEST 3: Room Double Booking Detection ---");
    const roomConflict = await prisma.timetable.findFirst({
      where: {
        schoolId: school.id,
        classroomId: classroom.id,
        dayOfWeek: "FRIDAY",
        startTime: { lt: "14:45" },
        endTime: { gt: "14:30" }
      }
    });
    assert(roomConflict !== null && roomConflict.id === session.id, "Room conflict correctly identified overlapping slot");

    // Clean up timetable session
    await prisma.timetable.delete({ where: { id: session.id } });
    console.log("   Cleaned up test session");

    // --- TEST 4: Student Attendance Upsert & Status Tracking ---
    console.log("\n--- TEST 4: Student Attendance Record Upsert ---");
    const testStudent = school.students[0];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const attRecord = await prisma.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId: school.id,
          studentId: testStudent.id,
          date: today
        }
      },
      update: { status: "PRESENT", notes: "Verified in test" },
      create: {
        schoolId: school.id,
        studentId: testStudent.id,
        date: today,
        status: "PRESENT",
        notes: "Verified in test"
      }
    });
    assert(attRecord.status === "PRESENT", `Student attendance recorded with status: ${attRecord.status}`);

    // Update to Excused
    const updatedRecord = await prisma.studentAttendance.update({
      where: { id: attRecord.id },
      data: { status: "EXCUSED", notes: "Medical leave" }
    });
    assert(updatedRecord.status === "EXCUSED", `Student attendance successfully transitioned to: ${updatedRecord.status}`);

    // --- TEST 5: Staff Attendance Record Tracking ---
    console.log("\n--- TEST 5: Faculty Attendance Record Tracking ---");
    const staffAttRecord = await prisma.staffAttendance.upsert({
      where: {
        schoolId_staffId_date: {
          schoolId: school.id,
          staffId: teacher.id,
          date: today
        }
      },
      update: { status: "PRESENT" },
      create: {
        schoolId: school.id,
        staffId: teacher.id,
        date: today,
        status: "PRESENT"
      }
    });
    assert(staffAttRecord.status === "PRESENT", `Faculty attendance recorded with status: ${staffAttRecord.status}`);

    console.log("\n=================================================================");
    console.log(`  DIRECT DB VERIFICATION SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log("=================================================================\n");

    if (failed > 0) process.exit(1);

  } catch (err) {
    console.error("❌ Direct DB verification error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchedulingDirect();
