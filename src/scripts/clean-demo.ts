import { basePrisma } from "@/lib/tenant-prisma";

async function cleanDemo() {
  const demoSchools = await basePrisma.school.findMany({
    where: {
      OR: [
        { subdomain: "demo" },
        { slug: "demo" },
        { name: "Demo School" },
      ],
    },
  });

  console.log("Found demo schools:", demoSchools.length);

  if (demoSchools.length > 0) {
    const primary = demoSchools[0];
    await basePrisma.school.update({
      where: { id: primary.id },
      data: {
        name: "Demo School",
        subdomain: "demo",
        slug: "demo",
        status: "ACTIVE",
        subscriptionStatus: "ACTIVE",
        isActive: true,
        isBanned: false,
        trialStartDate: null,
        trialEndDate: null,
      },
    });

    // Delete any other duplicate demo schools if existed
    for (let i = 1; i < demoSchools.length; i++) {
      console.log("Deleting duplicate demo:", demoSchools[i].id);
      await basePrisma.school.delete({ where: { id: demoSchools[i].id } });
    }
  }

  // Also clean up and sanitize Tenant table for demo
  try {
    const demoTenants = await basePrisma.tenant.findMany({
      where: {
        OR: [
          { subdomain: "demo" },
          { schoolName: "Demo School" },
        ],
      },
    });

    console.log("Found demo tenants:", demoTenants.length);

    if (demoTenants.length > 0) {
      const primaryTenant = demoTenants[0];
      await basePrisma.tenant.update({
        where: { id: primaryTenant.id },
        data: {
          schoolName: "Demo School",
          subdomain: "demo",
          status: "ACTIVE",
          subscriptionStatus: "Active",
          isDemo: true,
          isTrial: false,
          trialEndsAt: null,
        },
      });

      for (let i = 1; i < demoTenants.length; i++) {
        console.log("Deleting duplicate demo tenant:", demoTenants[i].id);
        await basePrisma.tenant.delete({ where: { id: demoTenants[i].id } });
      }
    }
  } catch (tenantErr) {
    console.warn("Tenant cleanup warning:", tenantErr);
  }

  console.log("Demo school and tenant sanitized successfully.");
}

cleanDemo().catch(console.error).finally(() => process.exit(0));
