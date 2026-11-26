import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import { sendSchoolRegistrationSuccessEmail } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { schoolId, subdomain, adminEmail } = body || {};

    if (!schoolId && !subdomain && !adminEmail) {
      return NextResponse.json(
        { success: false, error: "A valid schoolId, subdomain, or adminEmail is required to resend credentials." },
        { status: 400 }
      );
    }

    // 1. Locate school record
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          schoolId ? { id: schoolId } : undefined,
          subdomain ? { subdomain: subdomain.trim().toLowerCase() } : undefined,
          subdomain ? { slug: subdomain.trim().toLowerCase() } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        academicTiers: true,
        users: {
          where: { role: { in: ["SCHOOL_ADMIN", "PRINCIPAL", "HEADMASTER"] } },
          take: 1,
        },
      },
    });

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School or institutional tenant not found." },
        { status: 404 }
      );
    }

    const effectiveAdminEmail = (adminEmail || school.users?.[0]?.email || "").trim().toLowerCase();
    if (!effectiveAdminEmail || !effectiveAdminEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "No valid administrator email found for this institution." },
        { status: 400 }
      );
    }

    const effectiveTiers = school.academicTiers.map((t) => t.name);

    // 2. Dispatch Registration Success Email
    const emailResult = await sendSchoolRegistrationSuccessEmail({
      schoolName: school.name,
      subdomain: school.subdomain,
      adminEmail: effectiveAdminEmail,
      contactPhone: school.contactPhone || null,
      tiers: effectiveTiers.length > 0 ? effectiveTiers : ["Primary School"],
      schoolId: school.id,
    });

    return NextResponse.json({
      success: emailResult.success,
      deliveryStatus: emailResult.deliveryStatus,
      provider: (emailResult as any)?.provider || "DEFAULT",
      error: emailResult.error || null,
      message: emailResult.success
        ? `Confirmation credentials email successfully dispatched to ${effectiveAdminEmail}.`
        : `Email delivery attempted with status: ${emailResult.deliveryStatus}. ${emailResult.error || ""}`,
    });
  } catch (err: any) {
    console.error("[RESEND_EMAIL_API_ERROR]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to resend confirmation email." },
      { status: 500 }
    );
  }
}
