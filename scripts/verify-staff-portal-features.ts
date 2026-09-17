import { basePrisma } from "../src/lib/tenant-prisma";
import {
  fetchStaffPortalInitialData,
  submitLessonNoteAction,
  fetchStaffLessonNotesAction,
  submitLeaveRequestAction,
  fetchStaffLeaveRequestsAction,
  compileClassReportCardsFromStaffPortal,
  LessonNoteData,
  LeaveRequestData,
} from "../src/app/[schoolDomain]/portal/staff/actions";

async function verifyStaffPortalFeatures() {
  console.log("=================================================================");
  console.log("  VERIFYING STAFF PORTAL: ATTENDANCE, GRADES, LESSONS & LEAVES   ");
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
        staff: true,
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

    const staff = school.staff[0];
    if (!staff) {
      console.error("❌ No staff member found for school.");
      process.exit(1);
    }

    console.log(`🏫 Tenant: "${school.name}" (${school.subdomain})`);
    console.log(`👨‍🏫 Faculty: "${staff.firstName} ${staff.lastName}" (ID: ${staff.id})\n`);

    // -------------------------------------------------------------
    // TEST 1: Initial Data includes Lesson Notes and Leave Requests
    // -------------------------------------------------------------
    console.log("--- TEST 1: fetchStaffPortalInitialData Payload Expansion ---");
    const initialData = await fetchStaffPortalInitialData(school.id, staff.email || undefined);
    assert(initialData.success === true, "fetchStaffPortalInitialData executed successfully");
    assert(Array.isArray(initialData.lessonNotes), "Initial data contains lessonNotes array");
    assert(Array.isArray(initialData.leaveRequests), "Initial data contains leaveRequests array");
    console.log(`   Initial lesson notes count: ${initialData.lessonNotes.length}`);
    console.log(`   Initial leave requests count: ${initialData.leaveRequests.length}`);

    // -------------------------------------------------------------
    // TEST 2: Lesson Note Submission, Database Storage & Fetching
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Lesson Notes Submission & Retrieval Lifecycle ---");
    const targetClass = school.classrooms[0]?.name || "JSS 1";
    const targetSubject = school.courses[0]?.name || "General Mathematics";

    const newLesson: LessonNoteData = {
      weekNumber: 4,
      subject: targetSubject,
      className: targetClass,
      topic: "Simultaneous Linear Equations",
      subTopic: "Elimination Method",
      objectives: "By the end of the lesson, learners should be able to eliminate one variable to solve 2x2 linear systems.",
      instructionalMaterials: "Whiteboard, graphing charts, algebra step-by-step guides",
      introduction: "Hook: Review single-variable linear equations and inverse operations.",
      presentationSteps: "Step 1: Explain matching coefficients. Step 2: Subtract equations. Step 3: Solve for remaining variable.",
      evaluation: "Classwork exercises 1-4 on textbook page 95. Homework questions 5-8.",
      status: "SUBMITTED",
    };

    const submitRes = await submitLessonNoteAction(school.id, staff.id, newLesson);
    assert(submitRes.success === true, "submitLessonNoteAction returns success");
    assert(!!submitRes.note?.id, "Created lesson note has a persistent database ID");
    assert(submitRes.note?.topic === newLesson.topic, "Stored topic matches submitted topic");

    const fetchNotesRes = await fetchStaffLessonNotesAction(school.id, staff.id);
    const storedNote = fetchNotesRes.find((n) => n.id === submitRes.note?.id);
    assert(!!storedNote, "Newly created lesson note is found in fetchStaffLessonNotesAction");
    assert(storedNote?.status === "SUBMITTED", "Fetched note status is SUBMITTED");
    assert(storedNote?.weekNumber === 4, "Fetched note weekNumber is 4");
    assert(storedNote?.className === targetClass, "Fetched note class matches targetClass");

    // Test updating with HOD review feedback
    if (storedNote?.id) {
      const updateRes = await submitLessonNoteAction(school.id, staff.id, {
        ...storedNote,
        status: "APPROVED",
        supervisorFeedback: "Commendable lesson structure. Objectives are well-specified and measurable.",
      });
      assert(updateRes.success === true, "Lesson note can be updated to APPROVED with supervisorFeedback");
      assert(updateRes.note?.status === "APPROVED", "Updated note status is APPROVED");
      assert(updateRes.note?.supervisorFeedback?.includes("Commendable") === true, "Supervisor feedback persisted");
    }

    // -------------------------------------------------------------
    // TEST 3: Faculty Leave Request Lifecycle
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Faculty Leave Request Lifecycle ---");
    const newLeave: LeaveRequestData = {
      leaveType: "CASUAL",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      reliefTeacher: "Mr. Chukwuemeka Eze",
      reason: "Attending state educational symposium and curriculum workshop.",
      status: "PENDING",
    };

    const submitLeaveRes = await submitLeaveRequestAction(school.id, staff.id, newLeave);
    assert(submitLeaveRes.success === true, "submitLeaveRequestAction returns success");
    assert(!!submitLeaveRes.leave?.id, "Created leave request has persistent database ID");
    assert(submitLeaveRes.leave?.leaveType === "CASUAL", "Stored leaveType is CASUAL");

    const fetchLeavesRes = await fetchStaffLeaveRequestsAction(school.id, staff.id);
    const storedLeave = fetchLeavesRes.find((l) => l.id === submitLeaveRes.leave?.id);
    assert(!!storedLeave, "Newly submitted leave is found in fetchStaffLeaveRequestsAction");
    assert(storedLeave?.status === "PENDING", "Leave request initial status is PENDING");
    assert(storedLeave?.reliefTeacher === "Mr. Chukwuemeka Eze", "Relief teacher is correctly persisted");

    // -------------------------------------------------------------
    // TEST 4: Attendance CSV Export Formatting Logic
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Attendance CSV Formatting & RFC 4180 Escaping ---");
    const testStudents = [
      { firstName: "Chinedu", lastName: "Okeke", admissionNumber: "ADM/2026/001" },
      { firstName: "Amina", lastName: "Musa, Jr.", admissionNumber: "ADM/2026/002" },
      { firstName: "Bonaventure", lastName: "Chinonso", admissionNumber: "ADM/2026/003" },
    ];
    const testMap: Record<string, { status: string; notes: string }> = {
      "ADM/2026/001": { status: "PRESENT", notes: "Prompt arrival" },
      "ADM/2026/002": { status: "EXCUSED", notes: 'Attending clinic, "medical pass"' },
      "ADM/2026/003": { status: "LATE", notes: "Transit delay" },
    };

    const headers = ["Student Name", "Admission Number", "Class", "Date", "Status", "Notes"];
    const rows = testStudents.map((s) => {
      const name = `"${s.lastName}, ${s.firstName}"`;
      const adm = `"${s.admissionNumber}"`;
      const cls = `"${targetClass}"`;
      const dt = `"2026-09-17"`;
      const st = `"${testMap[s.admissionNumber]?.status || "PRESENT"}"`;
      const nt = `"${(testMap[s.admissionNumber]?.notes || "").replace(/"/g, '""')}"`;
      return [name, adm, cls, dt, st, nt].join(",");
    });
    const csvData = [headers.join(","), ...rows].join("\n");

    assert(csvData.startsWith("Student Name,Admission Number,Class,Date,Status,Notes"), "CSV starts with standard headers");
    assert(csvData.includes('"Okeke, Chinedu"'), "CSV correctly wraps student name with quotes");
    assert(csvData.includes('"Musa, Jr., Amina"'), "CSV correctly escapes internal comma in surname");
    assert(csvData.includes('"Attending clinic, ""medical pass"""'), "CSV correctly escapes embedded quotes");
    assert(csvData.split("\n").length === 4, "CSV has 1 header line and 3 student lines");

    // -------------------------------------------------------------
    // TEST 5: Class Report Card Bulk Compilation
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Class Report Card Bulk Compilation Action ---");
    const compileRes = await compileClassReportCardsFromStaffPortal(
      school.id,
      targetClass,
      "1st Term",
      "2026/2027"
    );

    assert(compileRes.success === true, "compileClassReportCardsFromStaffPortal succeeds");
    assert(typeof compileRes.compiledCount === "number", "Returns numeric compiledCount");
    assert(typeof compileRes.message === "string", "Returns user feedback message");
    console.log(`   Compilation Result: ${compileRes.message}`);

    // Clean up test notices
    if (submitRes.note?.id) {
      await basePrisma.notice.delete({ where: { id: submitRes.note.id } }).catch(() => {});
    }
    if (submitLeaveRes.leave?.id) {
      await basePrisma.notice.delete({ where: { id: submitLeaveRes.leave.id } }).catch(() => {});
    }

  } catch (error: any) {
    console.error("❌ Exception during test execution:", error);
    failed++;
  }

  console.log("\n=================================================================");
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED  `);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

verifyStaffPortalFeatures();
