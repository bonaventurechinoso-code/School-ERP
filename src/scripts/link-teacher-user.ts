import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const egede = await prisma.school.findFirst({
    where: { subdomain: "egede" },
  });

  if (!egede) {
    console.error("Egede school not found");
    return;
  }

  const staff = await prisma.staff.findFirst({
    where: {
      schoolId: egede.id,
      firstName: "Francisca",
      lastName: "Okoli",
    },
  });

  if (!staff) {
    console.error("Staff Francisca Okoli not found");
    return;
  }

  console.log("Found staff Francisca Okoli:", staff.id);

  let user = await prisma.user.findFirst({
    where: { email: "francisca.okoli@egede.edu.ng" },
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "francisca.okoli@egede.edu.ng",
        passwordHash,
        firstName: "Francisca",
        lastName: "Okoli",
        role: "TEACHER",
        schoolId: egede.id,
      },
    });
    console.log("Created User for Francisca Okoli:", user.id);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        role: "TEACHER",
        schoolId: egede.id,
      },
    });
    console.log("Updated User for Francisca Okoli:", user.id);
  }

  await prisma.staff.update({
    where: { id: staff.id },
    data: { userId: user.id },
  });

  console.log("Linked staff profile to user!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
