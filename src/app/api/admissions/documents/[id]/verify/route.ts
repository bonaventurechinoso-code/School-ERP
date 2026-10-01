import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await paramsPromise;
    const body = await request.json().catch(() => ({}));
    const targetDocId = body.id || body.docId || paramId;
    const applicantId = body.applicantId;
    const applicationNo = body.applicationNo;
    const isVerified = body.verified !== false && !body.rejected;

    // 1. Locate AdmissionRegister record
    let register = null;
    if (applicantId) {
      register = await prisma.admissionRegister.findUnique({
        where: { id: applicantId },
      }).catch(() => null);
    }

    if (!register && applicationNo) {
      register = await prisma.admissionRegister.findUnique({
        where: { applicationNo },
      }).catch(() => null);
    }

    if (!register && paramId) {
      register = await prisma.admissionRegister.findUnique({
        where: { id: paramId },
      }).catch(() => null);
    }

    // 2. If register found, update credentials_json verified flag
    if (register) {
      const currentCreds = Array.isArray(register.credentialsJson)
        ? [...register.credentialsJson]
        : [];

      let matched = false;
      const updatedCreds = currentCreds.map((d: any) => {
        const isMatch =
          d.id === targetDocId ||
          d.key === targetDocId ||
          d.type === targetDocId ||
          d.name === targetDocId ||
          d.docType === targetDocId;

        if (isMatch) {
          matched = true;
          return {
            ...d,
            verified: isVerified,
            status: isVerified ? "VERIFIED" : body.rejected ? "REJECTED" : "PENDING",
            verifiedAt: isVerified ? new Date().toISOString() : null,
          };
        }
        return d;
      });

      if (!matched && targetDocId) {
        updatedCreds.push({
          id: targetDocId,
          key: targetDocId,
          verified: isVerified,
          status: isVerified ? "VERIFIED" : body.rejected ? "REJECTED" : "PENDING",
          verifiedAt: isVerified ? new Date().toISOString() : null,
        });
      }

      await prisma.admissionRegister.update({
        where: { id: register.id },
        data: {
          credentialsJson: updatedCreds,
          verifiedAt: isVerified ? new Date() : register.verifiedAt,
          updatedAt: new Date(),
        },
      });
    }

    // 3. Locate and update AdmissionLead documents JSON
    let lead = null;
    if (applicantId) {
      lead = await prisma.admissionLead.findUnique({
        where: { id: applicantId },
      }).catch(() => null);
    }

    if (!lead && register) {
      lead = await prisma.admissionLead.findFirst({
        where: {
          schoolId: register.tenantId,
          OR: [
            { studentEmail: register.email || undefined },
            { parentPhone: register.parentPhone || undefined },
            { applicantName: `${register.firstName} ${register.lastName}`.trim() },
          ],
        },
      }).catch(() => null);
    }

    if (lead) {
      const currentDocs: any = (lead.documents as any) || {};
      let updatedDocs: any;

      if (Array.isArray(currentDocs)) {
        updatedDocs = currentDocs.map((d: any) => {
          if (
            d.id === targetDocId ||
            d.key === targetDocId ||
            d.type === targetDocId ||
            d.name === targetDocId
          ) {
            return {
              ...d,
              verified: isVerified,
              status: isVerified ? "VERIFIED" : body.rejected ? "REJECTED" : "PENDING",
              verifiedAt: isVerified ? new Date().toISOString() : null,
            };
          }
          return d;
        });
      } else if (typeof currentDocs === "object" && currentDocs !== null) {
        updatedDocs = { ...currentDocs };
        let docObjUpdated = false;

        for (const k of Object.keys(updatedDocs)) {
          if (
            k === targetDocId ||
            updatedDocs[k]?.id === targetDocId ||
            updatedDocs[k]?.type === targetDocId
          ) {
            docObjUpdated = true;
            updatedDocs[k] = {
              ...(typeof updatedDocs[k] === "object" ? updatedDocs[k] : { url: updatedDocs[k] }),
              verified: isVerified,
              status: isVerified ? "VERIFIED" : body.rejected ? "REJECTED" : "PENDING",
              verifiedAt: isVerified ? new Date().toISOString() : null,
            };
          }
        }

        if (!docObjUpdated && targetDocId) {
          updatedDocs[targetDocId] = {
            id: targetDocId,
            verified: isVerified,
            status: isVerified ? "VERIFIED" : body.rejected ? "REJECTED" : "PENDING",
            verifiedAt: isVerified ? new Date().toISOString() : null,
          };
        }
      } else {
        updatedDocs = {
          [targetDocId]: {
            id: targetDocId,
            verified: isVerified,
            status: isVerified ? "VERIFIED" : body.rejected ? "REJECTED" : "PENDING",
            verifiedAt: isVerified ? new Date().toISOString() : null,
          },
        };
      }

      await prisma.admissionLead.update({
        where: { id: lead.id },
        data: {
          documents: updatedDocs,
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Document marked as ${isVerified ? "Verified ✓" : "Rejected ✗"}`,
      id: targetDocId,
      verified: isVerified,
    });
  } catch (error: any) {
    console.error("[ADMISSION_DOC_VERIFY_PATCH] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update document verification status" },
      { status: 500 }
    );
  }
}
