import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    let tokenOverride: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      tokenOverride = authHeader.substring(7);
    } else {
      tokenOverride = req.headers.get("x-session-token");
    }

    if (!tokenOverride) {
      tokenOverride = req.headers.get("x-applicant-token") || req.headers.get("x-upload-token");
    }

    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    if (!tokenOverride && queryToken) {
      tokenOverride = queryToken;
    }

    let session = await getSession(tokenOverride);

    // If standard session not resolved, check if tokenOverride matches an applicant record
    if (!session && tokenOverride) {
      const lead = await basePrisma.admissionLead.findFirst({
        where: {
          OR: [
            { uploadToken: tokenOverride },
            { id: tokenOverride },
          ],
        },
        include: {
          school: { select: { id: true, name: true, subdomain: true } },
          tier: { select: { id: true, name: true } },
        },
      });

      if (lead) {
        session = {
          userId: lead.id,
          role: "GUEST_APPLICANT",
          applicantId: lead.id,
          tenantId: lead.schoolId,
          schoolDomain: lead.school?.subdomain || "default",
          applicantName: lead.applicantName,
          targetGrade: lead.targetGrade,
          activeTiers: [lead.tier?.name || "Standard Tier"],
          permissions: ["admissions:upload"],
          isGuestApplicant: true,
          uploadToken: lead.uploadToken || tokenOverride,
        } as any;
      } else {
        const reg = await basePrisma.admissionRegister.findFirst({
          where: {
            OR: [
              { id: tokenOverride },
              { applicationNo: tokenOverride },
            ],
          },
        });
        if (reg) {
          const creds: any = reg.credentialsJson || {};
          const regToken = creds.uploadToken || creds.token;
          if (regToken === tokenOverride || reg.id === tokenOverride || reg.applicationNo === tokenOverride) {
            session = {
              userId: reg.id,
              role: "GUEST_APPLICANT",
              applicantId: reg.id,
              tenantId: reg.tenantId,
              schoolDomain: "default",
              applicantName: `${reg.firstName} ${reg.lastName}`,
              targetGrade: reg.classApplied,
              activeTiers: ["Standard Tier"],
              permissions: ["admissions:upload"],
              isGuestApplicant: true,
              uploadToken: regToken || tokenOverride,
            } as any;
          }
        }
      }
    }

    if (!session) {
      return NextResponse.json(
        { success: false, authenticated: false, session: null },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        session,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("[API_AUTH_SESSION_ERROR]:", error);
    return NextResponse.json(
      { success: false, authenticated: false, session: null, error: "Failed to retrieve active session" },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}
