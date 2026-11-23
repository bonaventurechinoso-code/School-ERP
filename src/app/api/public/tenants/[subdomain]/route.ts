import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export async function GET(
  request: Request,
  context: { params: Promise<{ subdomain: string }> | { subdomain: string } }
) {
  try {
    const { subdomain } = await Promise.resolve(context.params);
    if (!subdomain) {
      return NextResponse.json({ success: false, error: "Subdomain is required" }, { status: 400 });
    }

    const school = await basePrisma.school.findUnique({
      where: { subdomain: subdomain.toLowerCase().trim() },
      include: {
        academicTiers: { select: { id: true, name: true, level: true }, orderBy: { level: "asc" } },
        staff: { select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    });

    if (!school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }

    const config = (school.tierDatabasesConfig as any) || {};

    return NextResponse.json({
      success: true,
      tenant: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        logo: school.logo || null,
        primary_color: config.primaryColor || "#4f46e5",
        motto: config.motto || school.welcomeGreeting || "Inspiring Excellence, Character & Knowledge",
        address: config.address || `${school.name} Campus, Nigeria`,
        phone: school.contactPhone || "+234 (0) 800 000 0000",
        email: school.staff[0]?.email || `admissions@${school.subdomain}.bonaveeict.com.ng`,
        about:
          config.about ||
          `Unified institutional portal for ${school.name}, serving academic excellence, moral discipline, and future leaders.`,
        welcomeGreeting: school.welcomeGreeting || "Welcome to our institution!",
        isPublicPortalEnabled: school.isPublicPortalEnabled,
        academicTiers: school.academicTiers.map((t) => ({ id: t.id, name: t.name })),
      },
    });
  } catch (error: any) {
    console.error("[api/public/tenants] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch tenant profile" }, { status: 500 });
  }
}
