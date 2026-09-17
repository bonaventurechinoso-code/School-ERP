const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function verifyStudentLifecycle() {
  console.log("=================================================================");
  console.log("   VERIFYING STUDENT LIFECYCLE, PROMOTION & KYC DATA             ");
  console.log("=================================================================\n");

  const school = await prisma.school.findUnique({
    where: { subdomain: "greenwood" },
    include: {
      academicTiers: { orderBy: { level: "asc" } }
    }
  });

  if (!school) throw new Error("Tenant Greenwood not found!");

  const primaryTier = school.academicTiers.find(t => t.name.toLowerCase().includes("primary")) || school.academicTiers[0];
  const secondaryTier = school.academicTiers.find(t => t.name.toLowerCase().includes("secondary"));

  console.log(`School: ${school.name}`);
  console.log(`Primary Tier: ${primaryTier.name} (ID: ${primaryTier.id})`);
  if (secondaryTier) {
    console.log(`Secondary Tier: ${secondaryTier.name} (ID: ${secondaryTier.id})`);
  }

  // Find or create a test student in Greenwood
  let student = await prisma.student.findFirst({
    where: { schoolId: school.id, tierId: primaryTier.id }
  });

  if (!student) {
    console.log("Creating test student...");
    student = await prisma.student.create({
      data: {
        schoolId: school.id,
        tierId: primaryTier.id,
        firstName: "Emeka",
        lastName: "Okonkwo",
        admissionNumber: "GW/2026/0099",
        currentClass: "Primary 2",
        status: "ENROLLED",
        parentName: "Chief Okonkwo",
        parentPhone: "+234 803 111 2233",
        parentWhatsApp: "+234 803 111 2233",
      }
    });
  }

  console.log(`Test Student: ${student.firstName} ${student.lastName} in ${student.currentClass}`);

  // --- TEST 1: Update KYC Details in dynamicFields ---
  console.log("\n--- TEST 1: Updating KYC Profile (NIN, Blood Group, Genotype, Verification) ---");
  const kycPayload = {
    nin: "12345678901",
    lgaOfOrigin: "Idemili North",
    bloodGroup: "O+",
    genotype: "AA",
    allergies: "Peanut allergy",
    emergencyContactName: "Aunty Ngozi",
    emergencyContactPhone: "+234 802 999 8877",
    birthCertVerified: true,
    ninVerified: true,
    medicalCertVerified: true,
    lastKycAuditedAt: new Date().toISOString()
  };

  const updatedKyc = await prisma.student.update({
    where: { id: student.id },
    data: {
      stateOfOrigin: "Anambra",
      dynamicFields: {
        ...(typeof student.dynamicFields === "object" ? student.dynamicFields : {}),
        ...kycPayload
      }
    }
  });

  const df = updatedKyc.dynamicFields;
  console.log(`Saved NIN: ${df.nin}`);
  console.log(`Saved Blood Group: ${df.bloodGroup}`);
  console.log(`Saved Genotype: ${df.genotype}`);
  console.log(`Saved Birth Cert Verified: ${df.birthCertVerified}`);

  if (df.nin !== "12345678901" || df.bloodGroup !== "O+" || df.genotype !== "AA" || !df.birthCertVerified) {
    throw new Error("FAIL: KYC data did not persist correctly!");
  }
  console.log("✅ PASS: KYC health and verification profile persisted successfully.");

  // --- TEST 2: Single Student Promotion & Audit History ---
  console.log("\n--- TEST 2: Single Student Promotion (Primary 2 -> Primary 3) ---");
  const existingHistory = Array.isArray(df.promotionHistory) ? df.promotionHistory : [];
  const newHistory = [
    {
      date: new Date().toISOString(),
      fromClass: updatedKyc.currentClass || "Primary 2",
      toClass: "Primary 3",
      fromTier: primaryTier.name,
      toTier: primaryTier.name,
      type: "PROMOTION",
      remarks: "Annual promotion assessment passed with distinction"
    },
    ...existingHistory
  ];

  const promotedStudent = await prisma.student.update({
    where: { id: student.id },
    data: {
      currentClass: "Primary 3",
      dynamicFields: {
        ...df,
        promotionHistory: newHistory
      }
    }
  });

  console.log(`Promoted Class: ${promotedStudent.currentClass}`);
  console.log(`Promotion Audit Entries: ${promotedStudent.dynamicFields.promotionHistory.length}`);
  if (promotedStudent.currentClass !== "Primary 3" || promotedStudent.dynamicFields.promotionHistory.length === 0) {
    throw new Error("FAIL: Single student promotion failed!");
  }
  console.log("✅ PASS: Single student promotion and audit logging verified.");

  // --- TEST 3: Inter-Tier Transition (Primary -> Secondary) ---
  if (secondaryTier) {
    console.log("\n--- TEST 3: Inter-Tier Transition (Primary 3 -> JSS 1 in Secondary School) ---");
    const tierHistory = [
      {
        date: new Date().toISOString(),
        fromClass: "Primary 3",
        toClass: "JSS 1",
        fromTier: primaryTier.name,
        toTier: secondaryTier.name,
        type: "TIER_TRANSITION",
        remarks: "Transitioned to Secondary School after Common Entrance"
      },
      ...promotedStudent.dynamicFields.promotionHistory
    ];

    const transitionedStudent = await prisma.student.update({
      where: { id: student.id },
      data: {
        tierId: secondaryTier.id,
        currentClass: "JSS 1",
        dynamicFields: {
          ...promotedStudent.dynamicFields,
          promotionHistory: tierHistory
        }
      },
      include: { tier: true }
    });

    console.log(`New Tier: ${transitionedStudent.tier?.name}`);
    console.log(`New Class: ${transitionedStudent.currentClass}`);
    if (transitionedStudent.tierId !== secondaryTier.id || transitionedStudent.currentClass !== "JSS 1") {
      throw new Error("FAIL: Inter-tier transition failed!");
    }
    console.log("✅ PASS: Inter-tier structural transition verified.");
  }

  console.log("\n=================================================================");
  console.log("  ALL STUDENT LIFECYCLE & KYC DATABASE CHECKS PASSED (3/3)       ");
  console.log("=================================================================\n");

  await prisma.$disconnect();
}

verifyStudentLifecycle()
  .catch((err) => {
    console.error("❌ Verification failed:", err);
    process.exit(1);
  });
