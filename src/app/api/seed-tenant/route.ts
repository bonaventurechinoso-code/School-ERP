import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export async function GET() {
  try {
    const demoSchool = await basePrisma.school.upsert({
      where: { subdomain: "demo" },
      update: {},
      create: {
        name: "Demo School",
        subdomain: "demo",
        slug: "demo",
        isActive: true,
      },
    });

    return NextResponse.json({
      message: "Demo tenant successfully seeded!",
      tenant: demoSchool,
    });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed demo tenant", details: error.message },
      { status: 500 }
    );
  }
}
