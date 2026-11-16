import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const joseph = await prisma.student.findUnique({
    where: { id: "3c3c837b-6a42-44a3-a34c-f6a8b6c2e002" },
  });

  if (!joseph) {
    console.error("Joseph not found");
    return;
  }

  const passwordHash = await bcrypt.hash("Password123", 10);

  const existingUser = await prisma.user.findUnique({
    where: { id: joseph.id },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: joseph.id,
        email: "joseph.okonkwo@egede.edu.ng",
        passwordHash,
        firstName: "Joseph",
        lastName: "Okonkwo",
        role: "STUDENT",
        schoolId: joseph.schoolId,
      },
    });
    console.log("Created matching User record for Joseph Okonkwo");
  } else {
    console.log("User record for Joseph Okonkwo already exists");
  }
}

main().finally(() => prisma.$disconnect());
