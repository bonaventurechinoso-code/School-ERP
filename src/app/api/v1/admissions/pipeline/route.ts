import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { basePrisma } from "@/lib/tenant-prisma";
import {
  verifyTenantAdminRole,
  verifyAdmissionsMutatorRole,
  evaluateStageConstraints,
  ensureTenantAdmissionTracks,
} from "@/lib/admissions-pipeline.service";
import { AdmissionTierType } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const schoolDomain = searchParams.get("schoolDomain") || "";

    if (!schoolId && !schoolDomain) {
      return NextResponse.json(
        { error: "400 Bad Request: schoolId or schoolDomain is required." },
        { status: 400 }
      );
    }

    const session = await getSession(undefined, schoolDomain);
    if (!session) {
      return NextResponse.json(
        { error: "401 Unauthorized: Valid session required." },
        { status: 401 }
      );
    }

    // Resolve tenant ID
    let targetTenantId = schoolId;
    if (!targetTenantId) {
      const school = await basePrisma.school.findFirst({
        where: {
          OR: [{ subdomain: schoolDomain }, { slug: schoolDomain }],
        },
        select: { id: true },
      });
      targetTenantId = school?.id || "";
    }

    if (!targetTenantId) {
      return NextResponse.json(
        { error: "404 Not Found: Tenant not found." },
        { status: 404 }
      );
    }

    const tracks = await ensureTenantAdmissionTracks(targetTenantId);

    return NextResponse.json({ success: true, tracks });
  } catch (error: any) {
    console.error("[AdmissionsPipeline API GET Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, schoolId, schoolDomain } = body;

    if (!action || (!schoolId && !schoolDomain)) {
      return NextResponse.json(
        { error: "400 Bad Request: Missing required action or tenant identifier." },
        { status: 400 }
      );
    }

    const session = await getSession(undefined, schoolDomain);

    // Resolve tenant
    let targetTenantId = schoolId;
    if (!targetTenantId || targetTenantId.includes("-") === false) {
      const school = await basePrisma.school.findFirst({
        where: {
          OR: [
            ...(schoolId ? [{ id: schoolId }, { subdomain: schoolId }] : []),
            ...(schoolDomain ? [{ subdomain: schoolDomain }, { slug: schoolDomain }] : []),
          ],
        },
        select: { id: true },
      });
      targetTenantId = school?.id || targetTenantId;
    }

    // =========================================================================
    // ACTION 1: TRANSITION_STAGE (Candidate move)
    // Permitted: Tenant Admin (own tenant) or Admissions Officer
    // Guardrail: Stage Constraint Verification
    // =========================================================================
    if (action === "TRANSITION_STAGE") {
      const auth = verifyAdmissionsMutatorRole(session, targetTenantId);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.reason || "403 Forbidden: Insufficient admissions privileges." },
          { status: 403 }
        );
      }

      const { leadId, registerId, targetStageId, targetStatus } = body;
      if (!leadId && !registerId) {
        return NextResponse.json(
          { error: "400 Bad Request: Candidate ID (leadId or registerId) is required." },
          { status: 400 }
        );
      }

      // Fetch candidate record and verify tenant boundary
      let candidate: any = null;
      if (leadId) {
        candidate = await basePrisma.admissionLead.findUnique({
          where: { id: leadId },
          include: { tier: true, track: true, stage: true },
        });
        if (candidate && candidate.schoolId !== targetTenantId) {
          return NextResponse.json(
            { error: "403 Forbidden: Cross-tenant candidate transition blocked." },
            { status: 403 }
          );
        }
      } else if (registerId) {
        candidate = await basePrisma.admissionRegister.findUnique({
          where: { id: registerId },
          include: { track: true, stage: true },
        });
        if (candidate && candidate.tenantId !== targetTenantId) {
          return NextResponse.json(
            { error: "403 Forbidden: Cross-tenant candidate transition blocked." },
            { status: 403 }
          );
        }
      }

      if (!candidate) {
        return NextResponse.json(
          { error: "404 Not Found: Candidate dossier not found." },
          { status: 404 }
        );
      }

      // Resolve target stage and constraints
      let targetStage = null;
      if (targetStageId) {
        targetStage = await basePrisma.admissionStage.findUnique({
          where: { id: targetStageId },
          include: { track: true },
        });
      }

      // STAGE CONSTRAINT VERIFICATION GUARDRAIL
      if (targetStage?.constraints) {
        const evaluation = evaluateStageConstraints(candidate, targetStage.constraints as any);
        if (!evaluation.satisfied) {
          return NextResponse.json(
            {
              error: "400 Bad Request: Stage guardrails not met.",
              missingPrerequisites: evaluation.missingPrerequisites,
              targetStageName: targetStage.name,
            },
            { status: 400 }
          );
        }
      }

      const newStatus = targetStatus || targetStage?.name || candidate.status;

      // Execute update on candidate
      let updatedRecord: any = null;
      if (leadId) {
        updatedRecord = await basePrisma.admissionLead.update({
          where: { id: leadId },
          data: {
            status: newStatus,
            stageId: targetStage?.id || candidate.stageId,
            trackId: targetStage?.trackId || candidate.trackId,
          },
          include: { tier: true, track: true, stage: true },
        });
      } else if (registerId) {
        updatedRecord = await basePrisma.admissionRegister.update({
          where: { id: registerId },
          data: {
            status: newStatus,
            stageId: targetStage?.id || candidate.stageId,
            trackId: targetStage?.trackId || candidate.trackId,
          },
          include: { track: true, stage: true },
        });
      }

      // Log Audit Trail
      try {
        await basePrisma.admissionAuditTrail.create({
          data: {
            tenantId: targetTenantId,
            registerId: candidate.id,
            actorId: session?.user?.id || session?.id || "admissions-officer",
            action: "STAGE_TRANSITION",
            fromStage: candidate.stage?.name || candidate.status,
            toStage: targetStage?.name || newStatus,
            metadata: {
              targetStageId: targetStage?.id || null,
              performedBy: session?.user?.email || session?.email || "staff",
              timestamp: new Date().toISOString(),
            },
          },
        });
      } catch (auditErr) {
        console.warn("[AdmissionsPipeline] Audit trail logging warning:", auditErr);
      }

      return NextResponse.json({
        success: true,
        candidate: updatedRecord,
        stage: targetStage,
      });
    }

    // =========================================================================
    // ACTION 2: CREATE_TRACK
    // Permitted: Tenant Admin ONLY (within own tenantId)
    // =========================================================================
    if (action === "CREATE_TRACK") {
      const auth = verifyTenantAdminRole(session, targetTenantId);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.reason || "403 Forbidden: Only the Tenant Admin can create admission tracks." },
          { status: 403 }
        );
      }

      const { name, tierType, description } = body;
      if (!name) {
        return NextResponse.json(
          { error: "400 Bad Request: Track name is required." },
          { status: 400 }
        );
      }

      const validTier = Object.values(AdmissionTierType).includes(tierType)
        ? tierType
        : AdmissionTierType.PRIMARY;

      const track = await basePrisma.admissionTrack.create({
        data: {
          tenantId: targetTenantId,
          name: name.trim(),
          tierType: validTier,
          description: description?.trim() || null,
          isActive: true,
        },
      });

      // Seed default sequential stages for the newly created track
      const defaultStages = [
        { name: "Inquiry & Prospect Log", sequenceOrder: 0, color: "#94a3b8", constraints: {} },
        { name: "Documentation & Intake", sequenceOrder: 1, color: "#f59e0b", constraints: { require_birth_cert: true } },
        { name: "Screening & Assessment", sequenceOrder: 2, color: "#8b5cf6", constraints: { require_payment: true } },
        { name: "Provisional Offer", sequenceOrder: 3, color: "#3b82f6", constraints: {} },
        { name: "Matriculated", sequenceOrder: 4, color: "#10b981", constraints: {} },
      ];

      for (const s of defaultStages) {
        await basePrisma.admissionStage.create({
          data: {
            trackId: track.id,
            name: s.name,
            sequenceOrder: s.sequenceOrder,
            color: s.color,
            constraints: s.constraints,
          },
        });
      }

      const completeTrack = await basePrisma.admissionTrack.findUnique({
        where: { id: track.id },
        include: { stages: { orderBy: { sequenceOrder: "asc" } } },
      });

      return NextResponse.json({ success: true, track: completeTrack }, { status: 201 });
    }

    // =========================================================================
    // ACTION 3: CONFIGURE_STAGE (Create or update customizable stage & constraints)
    // Permitted: Tenant Admin ONLY
    // =========================================================================
    if (action === "CONFIGURE_STAGE") {
      const auth = verifyTenantAdminRole(session, targetTenantId);
      if (!auth.authorized) {
        return NextResponse.json(
          { error: auth.reason || "403 Forbidden: Only the Tenant Admin can configure stage constraints." },
          { status: 403 }
        );
      }

      const { stageId, trackId, name, sequenceOrder, constraints, color } = body;

      if (stageId) {
        // Update existing stage
        const existing = await basePrisma.admissionStage.findUnique({
          where: { id: stageId },
          include: { track: true },
        });

        if (!existing || existing.track.tenantId !== targetTenantId) {
          return NextResponse.json(
            { error: "404 Not Found: Admission stage does not exist in your tenant pipeline." },
            { status: 404 }
          );
        }

        const updated = await basePrisma.admissionStage.update({
          where: { id: stageId },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(typeof sequenceOrder === "number" ? { sequenceOrder } : {}),
            ...(constraints !== undefined ? { constraints } : {}),
            ...(color ? { color } : {}),
          },
        });

        return NextResponse.json({ success: true, stage: updated });
      } else {
        // Create new stage
        if (!trackId || !name) {
          return NextResponse.json(
            { error: "400 Bad Request: trackId and stage name are required." },
            { status: 400 }
          );
        }

        const track = await basePrisma.admissionTrack.findUnique({
          where: { id: trackId },
        });

        if (!track || track.tenantId !== targetTenantId) {
          return NextResponse.json(
            { error: "403 Forbidden: Target track not found or cross-tenant manipulation attempted." },
            { status: 403 }
          );
        }

        const stage = await basePrisma.admissionStage.create({
          data: {
            trackId,
            name: name.trim(),
            sequenceOrder: sequenceOrder ?? 0,
            constraints: constraints || {},
            color: color || "#3b82f6",
          },
        });

        return NextResponse.json({ success: true, stage }, { status: 201 });
      }
    }

    return NextResponse.json(
      { error: `400 Bad Request: Unknown pipeline action "${action}".` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[AdmissionsPipeline API POST Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

