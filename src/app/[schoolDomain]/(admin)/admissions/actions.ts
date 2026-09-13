"use server";

import { basePrisma, getPrismaClientForTier, invalidateTierConnection, resolveTierIdForTierDb } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import { sendAdmissionOfferEmail } from "@/lib/email-service";
import { triggerInquiryNotification } from "@/lib/admissions-events";

export type AdmissionActionResult = {
  success: boolean;
  student?: any;
  lead?: any;
  tierName?: string;
  error?: string;
};

export async function enrollApplicantAction(payload: {
  leadId: string;
  schoolId: string;
  schoolDomain: string;
}): Promise<AdmissionActionResult> {
  const { leadId, schoolId, schoolDomain } = payload;
  try {
    if (!leadId || !schoolId) {
      return { success: false, error: "leadId and schoolId are required." };
    }

    // 1. Fetch applicant lead with academic tier context
    const lead = await basePrisma.admissionLead.findUnique({
      where: { id: leadId },
      include: { tier: true },
    });

    if (!lead) {
      return { success: false, error: "Applicant lead not found." };
    }

    if (lead.status === "ENROLLED") {
      return { success: false, error: "Applicant is already marked as enrolled." };
    }

    // 2. DYNAMIC ENROLLMENT TARGET ROUTING:
    // Dynamically initialize the Prisma client connected strictly to this applicant's designated tier database
    const targetTier = lead.tier?.name || lead.tierId;
    const tierDb = await getPrismaClientForTier(schoolId, targetTier);
    const isolatedTierId = await resolveTierIdForTierDb(tierDb, schoolId, {
      id: lead.tierId,
      name: lead.tier?.name,
      level: lead.tier?.level,
    });

    const school = await basePrisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, subdomain: true },
    });

    const [firstName, ...lastNameParts] = (lead.applicantName || "").trim().split(" ");
    const lastName = lastNameParts.join(" ") || "Enrolled";

    // Generate isolated tier admission number
    const studentCount = await tierDb.student.count();
    const prefix = school ? school.subdomain.toUpperCase().substring(0, 3) : "SCH";
    const year = new Date().getFullYear();
    const seq = String(studentCount + 1).padStart(3, "0");
    const admissionNumber = `${prefix}/${year}/${seq}`;

    // 3. Write student profile directly into the isolated tier database's Student table
    const existingStudent = await tierDb.student.findFirst({
      where: {
        schoolId: lead.schoolId,
        OR: [
          ...(lead.studentEmail ? [{ email: lead.studentEmail }] : []),
          { admissionNumber },
        ],
      },
    });

    let newStudent;
    if (existingStudent) {
      newStudent = await tierDb.student.update({
        where: { id: existingStudent.id },
        data: {
          status: "ENROLLED",
          enrolledAt: new Date(),
          tierId: isolatedTierId,
          currentClass: lead.targetGrade || existingStudent.currentClass,
        },
      });
    } else {
      newStudent = await tierDb.student.create({
        data: {
          schoolId: lead.schoolId,
          tierId: isolatedTierId,
          firstName: firstName || "Student",
          lastName,
          email: lead.studentEmail || null,
          parentName: lead.parentName || null,
          parentEmail: lead.parentEmail || null,
          parentPhone: lead.parentPhone || lead.parentContact || null,
          currentClass: lead.targetGrade || null,
          admissionNumber,
          status: "ENROLLED",
          enrolledAt: new Date(),
        },
      });
    }

    // 4. Update the central AdmissionLead record
    const updatedLead = await basePrisma.admissionLead.update({
      where: { id: leadId },
      data: {
        status: "ENROLLED",
        updatedAt: new Date(),
      },
    });

    // 5. ROSTER DYNAMIC SYNC REFRESH:
    // Invalidate cached query instances and revalidate relevant routes
    invalidateTierConnection();

    const domain = schoolDomain || school?.subdomain;
    try {
      if (domain) {
        revalidatePath(`/${domain}/students`);
        revalidatePath(`/${domain}/admissions`);
        revalidatePath(`/${domain}/dashboard`);
        revalidatePath(`/${domain}/scheduling`);
      }
      revalidatePath("/[schoolDomain]/(admin)/students", "page");
      revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
      revalidatePath("/[schoolDomain]/(admin)/dashboard", "page");
    } catch {
      // In non-request execution contexts (e.g. testing scripts), revalidatePath is a no-op
    }

    return {
      success: true,
      student: newStudent,
      lead: updatedLead,
      tierName: lead.tier?.name || "Default Tier",
    };
  } catch (error: any) {
    console.error("Error executing enrollApplicantAction:", error);
    return { success: false, error: error?.message || "Failed to finalize enrollment." };
  }
}

export async function updateLeadStatusAction(payload: {
  leadId: string;
  status: string;
  schoolId: string;
  schoolDomain: string;
}): Promise<AdmissionActionResult> {
  const { leadId, status, schoolId, schoolDomain } = payload;
  try {
    if (!leadId || !status || !schoolId) {
      return { success: false, error: "Missing required parameters." };
    }

    if (status === "ENROLLED") {
      return await enrollApplicantAction({ leadId, schoolId, schoolDomain });
    }

    let updatedLead;

    if (status === "APPROVED") {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      updatedLead = await basePrisma.admissionLead.update({
        where: { id: leadId },
        data: {
          status,
          offerToken: token,
          offerExpiresAt: expiresAt,
        },
      });

      const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
      if (school) {
        try {
          await sendAdmissionOfferEmail(updatedLead, school, token);
        } catch (mailErr) {
          console.warn("Failed to dispatch admission offer email:", mailErr);
        }
      }
    } else {
      updatedLead = await basePrisma.admissionLead.update({
        where: { id: leadId },
        data: { status },
      });

      if (status === "INQUIRY") {
        const school = await basePrisma.school.findUnique({ where: { id: schoolId } });
        triggerInquiryNotification({
          leadId,
          schoolId,
          lead: updatedLead,
          school,
          force: true,
        });
      }
    }

    const domain = schoolDomain;
    try {
      if (domain) {
        revalidatePath(`/${domain}/admissions`);
        revalidatePath(`/${domain}/dashboard`);
      }
      revalidatePath("/[schoolDomain]/(admin)/admissions", "page");
      revalidatePath("/[schoolDomain]/(admin)/dashboard", "page");
    } catch {
      // In non-request execution contexts, revalidatePath is a no-op
    }

    return { success: true, lead: updatedLead };
  } catch (error: any) {
    console.error("Error executing updateLeadStatusAction:", error);
    return { success: false, error: error?.message || "Failed to update lead status." };
  }
}
