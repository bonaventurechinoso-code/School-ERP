const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  console.log("=== SEEDING EGEDE SCHOOL & LEADS LOCALLY ===");

  // 1. Check or create Egede School
  let school = await prisma.school.findFirst({
    where: {
      OR: [
        { subdomain: 'egede' },
        { slug: 'egede' },
      ],
    },
    include: {
      academicTiers: true,
    },
  });

  if (!school) {
    const schoolId = crypto.randomUUID();
    console.log(`Creating school Egede (${schoolId})...`);
    school = await prisma.school.create({
      data: {
        id: schoolId,
        name: 'Egede Primary School',
        subdomain: 'egede',
        slug: 'egede',
        status: 'ACTIVE',
        isActive: true,
        welcomeGreeting: 'Welcome to Egede Primary School!',
      },
      include: {
        academicTiers: true,
      },
    });
    console.log('School created:', school.name);
  } else {
    console.log('Egede School already exists:', school.id, school.name);
  }

  // 2. Ensure Primary School AcademicTier exists
  let tier = school.academicTiers.find((t) => t.name.toLowerCase().includes('primary'));
  if (!tier) {
    console.log('Creating Primary School tier for Egede...');
    tier = await prisma.academicTier.create({
      data: {
        id: crypto.randomUUID(),
        schoolId: school.id,
        name: 'Primary School',
        level: 1,
      },
    });
    console.log('Tier created:', tier.name, tier.id);
  } else {
    console.log('Primary School tier exists:', tier.name, tier.id);
  }

  // 3. Ensure 2 Admission Inquiries exist for Egede
  const existingLeads = await prisma.admissionLead.findMany({
    where: { schoolId: school.id },
  });

  if (existingLeads.length < 2) {
    console.log(`Seeding 2 inquiries for Egede school (${school.id})...`);
    
    await prisma.admissionLead.create({
      data: {
        schoolId: school.id,
        tierId: tier.id,
        applicantName: 'Chinedu Eze',
        studentEmail: 'chinedu.eze@example.com',
        parentName: 'Mr. Emeka Eze',
        parentPhone: '+2348012345678',
        parentContact: '+2348012345678',
        targetGrade: 'Primary 3',
        source: 'Walk-In',
        status: 'INQUIRY',
      },
    });

    await prisma.admissionLead.create({
      data: {
        schoolId: school.id,
        tierId: tier.id,
        applicantName: 'Amaka Nwosu',
        studentEmail: 'amaka.nwosu@example.com',
        parentName: 'Mrs. Ngozi Nwosu',
        parentPhone: '+2348098765432',
        parentContact: '+2348098765432',
        targetGrade: 'Primary 5',
        source: 'Online Referral',
        status: 'INQUIRY',
      },
    });

    console.log('Successfully seeded 2 inquiries for Egede!');
  } else {
    console.log(`Egede already has ${existingLeads.length} leads.`);
  }

  // 4. Verify
  const totalLeads = await prisma.admissionLead.findMany({
    where: { schoolId: school.id },
  });
  console.log(`\nVerification: School ${school.name} (${school.subdomain}) has ${totalLeads.length} leads in database.`);
  for (const l of totalLeads) {
    console.log(`- Lead: ${l.applicantName} | Status: ${l.status} | TierId: ${l.tierId}`);
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
