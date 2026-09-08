const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  let tenant = await prisma.school.findFirst({
    where: { subdomain: 'udoka' }
  });

  if (!tenant) {
    console.log("Tenant 'udoka' not found. Creating a temporary 'udoka' tenant for testing...");
    tenant = await prisma.school.create({
      data: {
        name: 'Udoka Primary School',
        subdomain: 'udoka',
        isActive: true,
      }
    });
    console.log("Created Tenant:", tenant.subdomain);
  }

  const existingStaff = await prisma.staff.findFirst({
    where: { email: 'staff@school.edu', schoolId: tenant.id }
  });

  const hashedPassword = await bcrypt.hash('Password123', 10);

  if (existingStaff) {
    console.log("Staff already exists, updating password and role to be sure...");
    await prisma.staff.update({
      where: { id: existingStaff.id },
      data: { password: hashedPassword, role: 'ADMIN', status: 'ACTIVE' }
    });
    console.log("Staff updated successfully.");
  } else {
    const staff = await prisma.staff.create({
      data: {
        schoolId: tenant.id,
        firstName: 'Test',
        lastName: 'Admin',
        email: 'staff@school.edu',
        password: hashedPassword,
        role: 'ADMIN',
        status: 'ACTIVE',
      }
    });
    console.log("Successfully created test staff credentials:");
    console.log("Email:", staff.email);
    console.log("Role:", staff.role);
    console.log("Tenant ID:", staff.schoolId);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
