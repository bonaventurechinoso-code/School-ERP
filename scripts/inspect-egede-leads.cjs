const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== INSPECTING EGEDE SCHOOL & LEADS ===");
  
  // 1. Search for school by subdomain or slug
  const egedeSchool = await prisma.school.findFirst({
    where: {
      OR: [
        { subdomain: { equals: 'egede', mode: 'insensitive' } },
        { slug: { equals: 'egede', mode: 'insensitive' } },
        { name: { contains: 'egede', mode: 'insensitive' } },
      ]
    },
    include: {
      academicTiers: true
    }
  });

  console.log('Egede School Query Result:', egedeSchool ? {
    id: egedeSchool.id,
    name: egedeSchool.name,
    subdomain: egedeSchool.subdomain,
    slug: egedeSchool.slug,
    tiers: egedeSchool.academicTiers.map(t => ({ id: t.id, name: t.name }))
  } : 'NOT FOUND in local DB');

  if (egedeSchool) {
    const leads = await prisma.admissionLead.findMany({
      where: { schoolId: egedeSchool.id }
    });
    console.log(`\nLeads for Egede (${egedeSchool.id}): count = ${leads.length}`);
    for (const l of leads) {
      console.log(`- Lead ID: ${l.id}, Name: ${l.applicantName}, Status: ${l.status}, Grade: ${l.targetGrade}, TierId: ${l.tierId}`);
    }
  }

  // 2. Also inspect all schools in local DB
  const allSchools = await prisma.school.findMany({
    select: { id: true, name: true, subdomain: true, slug: true }
  });
  console.log('\nAll Schools in DB:', allSchools);

  // 3. Inspect all admission leads in local DB grouped by schoolId
  const allLeads = await prisma.admissionLead.findMany({
    select: { id: true, applicantName: true, status: true, schoolId: true, tierId: true }
  });
  console.log(`\nTotal AdmissionLeads in DB: ${allLeads.length}`);
  const leadsBySchool = {};
  for (const l of allLeads) {
    leadsBySchool[l.schoolId] = (leadsBySchool[l.schoolId] || 0) + 1;
  }
  console.log('Leads count by schoolId:', leadsBySchool);

  // 4. Inquiries specifically
  const inquiries = allLeads.filter(l => l.status === 'INQUIRY');
  console.log(`Total INQUIRY leads in DB: ${inquiries.length}`);
  for (const inq of inquiries) {
    console.log(`- Inquiry: ${inq.applicantName}, schoolId: ${inq.schoolId}, tierId: ${inq.tierId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
