import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createStudent } from "../src/app/[schoolDomain]/(admin)/students/actions";

const prisma = new PrismaClient();

async function main() {
  console.log("=== STEP 1: Verify School Exists ===");
  const school = await prisma.school.findFirst({
    where: { subdomain: "demo" },
    include: { academicTiers: true },
  });

  if (!school) {
    throw new Error("Demo school not found");
  }
  console.log(`Found school: ${school.name} (id: ${school.id}, slug: ${school.slug || school.subdomain})`);

  const tierId = school.academicTiers[0]?.id;
  if (!tierId) {
    throw new Error("No academic tier found for demo school");
  }

  console.log("\n=== STEP 2: Execute createStudent with Parent Details ===");
  const testParentEmail = "bonaventure.chinoso+parent@gmail.com";
  const studentPayload = {
    firstName: "Test",
    lastName: "Student",
    tierId: tierId,
    currentClass: "JSS1",
    status: "ENROLLED",
    parentName: "Your Test Parent",
    parentEmail: testParentEmail,
    parentPhone: "+2348012345678",
    relationship: "Father",
  };

  const createResult = await createStudent(school.id, studentPayload);
  console.log("createStudent Result:", createResult);

  if (!createResult.success) {
    throw new Error(`Failed to create student: ${createResult.error}`);
  }

  console.log("\n=== STEP 3: Verify Database Records ===");
  const parentInDb = await prisma.parent.findFirst({
    where: {
      schoolId: school.id,
      email: testParentEmail,
    },
    include: {
      students: {
        include: {
          student: true,
        },
      },
    },
  });

  console.log("Parent in DB:", {
    id: parentInDb?.id,
    name: parentInDb?.name,
    email: parentInDb?.email,
    phone: parentInDb?.phone,
    relationship: parentInDb?.relationship,
    isActive: parentInDb?.isActive,
    linkedStudentsCount: parentInDb?.students.length,
    linkedStudentNames: parentInDb?.students.map(s => `${s.student.firstName} ${s.student.lastName}`),
  });

  if (!parentInDb) {
    throw new Error("Parent record was not found in database!");
  }

  if (parentInDb.students.length === 0) {
    throw new Error("StudentParent link was not created!");
  }

  console.log("\n=== STEP 4: Test Password Verification for 'Parent123' ===");
  const isPasswordValid = await bcrypt.compare("Parent123", parentInDb.passwordHash);
  console.log("Password compare 'Parent123':", isPasswordValid);
  if (!isPasswordValid) {
    throw new Error("Default password 'Parent123' does not match parent password hash!");
  }

  console.log("\n=== STEP 5: Verify User Auth Table Synchronization ===");
  const userInDb = await prisma.user.findFirst({
    where: {
      schoolId: school.id,
      email: testParentEmail,
    },
  });

  console.log("User in DB:", {
    id: userInDb?.id,
    email: userInDb?.email,
    role: userInDb?.role,
  });

  if (!userInDb || userInDb.role !== "PARENT") {
    throw new Error("User record with role PARENT was not synchronized!");
  }

  console.log("\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
