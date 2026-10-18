import { basePrisma } from "@/lib/tenant-prisma";
import TenantsConsoleView from "./TenantsConsoleView";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const BASE_PLATFORM_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BASE_URL ||
  "https://bonaveeict.com.ng"
).replace(/\/$/, "");

export default async function TenantsPage() {
  const session = await getSession();
  const role = ((session?.role || session?.userRole || "") as string).toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN" || session?.isSuperAdmin;

  if (session && !isSuperAdmin) {
    redirect("/access-denied");
  }

  let schools: any[] = [];
  try {
    const dbSchools = await basePrisma.school.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      include: {
        academicTiers: true,
        _count: {
          select: { students: true, staff: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    schools = dbSchools.map((s) => ({
      ...s,
      students_count: s._count.students,
      staff_count: s._count.staff,
      academic_tiers: s.academicTiers.map((t) => ({ name: t.name, id: t.id })),
    }));
  } catch (e) {
    console.error("[TenantsPage] Fetch error:", e);
  }

  return (
    <TenantsConsoleView
      schools={schools}
      basePlatformUrl={BASE_PLATFORM_URL}
    />
  );
}
