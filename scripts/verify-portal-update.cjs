const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testSettingsRoundtrip() {
  console.log("=================================================================");
  console.log("   TESTING PORTAL SETTINGS PERSISTENCE & DB SYNC                 ");
  console.log("=================================================================\n");

  const school = await prisma.school.findUnique({
    where: { subdomain: "greenwood" },
    include: { academicTiers: true }
  });

  if (!school) {
    throw new Error("Greenwood school tenant not found!");
  }

  console.log(`Initial School: ${school.name}`);
  console.log(`Initial Phone: ${school.contactPhone}`);
  console.log(`Initial Greeting: ${school.welcomeGreeting}`);
  console.log(`Initial Public Enabled: ${school.isPublicPortalEnabled}`);
  console.log(`Academic Tiers count: ${school.academicTiers.length}`);

  // Test updating phone and greeting
  const updated = await prisma.school.update({
    where: { id: school.id },
    data: {
      contactPhone: "+234 803 555 0199",
      welcomeGreeting: "Excellence in Nigerian Education: Nursery, Primary & Secondary Pathways",
      isPublicPortalEnabled: true,
    }
  });

  console.log(`Updated Phone: ${updated.contactPhone}`);
  console.log(`Updated Greeting: ${updated.welcomeGreeting}`);

  // Verify fetch matches
  const refetched = await prisma.school.findUnique({
    where: { subdomain: "greenwood" },
  });

  if (refetched.contactPhone !== "+234 803 555 0199") {
    throw new Error("Phone update verification failed!");
  }
  if (!refetched.welcomeGreeting.includes("Excellence in Nigerian Education")) {
    throw new Error("Welcome greeting verification failed!");
  }

  console.log("✅ PASS: Database roundtrip & persistence verified successfully.\n");
  await prisma.$disconnect();
}

testSettingsRoundtrip().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
