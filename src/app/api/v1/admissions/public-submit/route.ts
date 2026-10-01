import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { triggerInquiryNotification } from "@/lib/admissions-events";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, validatePasswordStrength } from "@/lib/security-service";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { 
      schoolDomain, 
      applicantName, 
      studentEmail,
      studentPhone,
      parentName, 
      parentContact, 
      parentEmail, 
      tierId, 
      targetGrade,
      password,
    } = data;

    const headerTenantId = request.headers.get("x-tenant-id") || request.headers.get("tenant-id");
    const domainCandidate = schoolDomain || headerTenantId;

    if (!domainCandidate || !applicantName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Lookup tenant ID from id, subdomain, or slug
    const school = await basePrisma.school.findFirst({
      where: {
        OR: [
          { id: domainCandidate },
          { subdomain: domainCandidate.toLowerCase().trim() },
          { slug: domainCandidate.toLowerCase().trim() },
        ],
      },
      include: { academicTiers: true },
    });

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const effectiveTierId = tierId || school.academicTiers[0]?.id;
    const effectiveTargetGrade = targetGrade || "Class 1";

    const tenantDb = getTenantClient(school.id);

    // Process & Hash Password
    let passwordToSave = "Welcome123";
    let isTemporary = true;

    if (password && typeof password === "string" && password.trim().length > 0) {
      const validation = validatePasswordStrength(password.trim());
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Password does not meet security requirements." },
          { status: 400 }
        );
      }
      passwordToSave = password.trim();
      isTemporary = false;
    }

    const hashedPassword = await bcrypt.hash(passwordToSave, 10);

    // Insert new application explicitly as INQUIRY
    const newLead = await tenantDb.admissionLead.create({
      data: {
        schoolId: school.id,
        applicantName,
        studentEmail,
        studentPhone,
        parentName,
        parentContact: parentContact || "N/A",
        parentPhone: parentContact || null,
        parentEmail,
        tierId: effectiveTierId!,
        targetGrade: effectiveTargetGrade,
        source: "Website",
        status: "INQUIRY",
        documents: {
          passwordHash: hashedPassword,
        },
      }
    });

    // Global Admission Register record creation with tenantId scoping
    let appNo = `APP-${Date.now().toString().slice(-6)}`;
    try {
      const { generateApplicationNo } = await import("@/modules/enrollment/enrollment.controller");
      appNo = await generateApplicationNo(school.id);
      const nameParts = (applicantName || "Student").trim().split(" ");
      const fName = nameParts[0] || "Student";
      const lName = nameParts.slice(1).join(" ") || "Applicant";
      await basePrisma.admissionRegister.create({
        data: {
          tenantId: school.id,
          applicationNo: appNo,
          firstName: fName,
          lastName: lName,
          classApplied: effectiveTargetGrade,
          parentPhone: parentContact || studentPhone || "N/A",
          email: studentEmail || parentEmail || null,
          status: "docs_pending",
        },
      });
    } catch (regErr: any) {
      if (regErr?.code === "P2002") {
        console.warn("[PUBLIC_SUBMIT] Unique constraint on admissionRegister:", regErr);
      } else {
        console.warn("[PUBLIC_SUBMIT] Warning: could not mirror to admission_registers:", regErr);
      }
    }

    // Provision or sync Student portal user record
    const accountEmail = (studentEmail || parentEmail || "").trim().toLowerCase();
    if (accountEmail) {
      try {
        let existingStudent = await tenantDb.student.findFirst({
          where: {
            schoolId: school.id,
            email: { equals: accountEmail, mode: "insensitive" },
          },
        });

        if (existingStudent) {
          const currentFields = (existingStudent.dynamicFields as any) || {};
          await tenantDb.student.update({
            where: { id: existingStudent.id },
            data: {
              dynamicFields: {
                ...currentFields,
                password: hashedPassword,
                isTemporaryPassword: isTemporary,
              },
            },
          });
          await setUserMustChangePassword(existingStudent.id, school.id, isTemporary);
        } else {
          const nameParts = applicantName.trim().split(" ");
          const firstName = nameParts[0] || "Student";
          const lastName = nameParts.slice(1).join(" ") || "Applicant";

          const createdStudent = await tenantDb.student.create({
            data: {
              schoolId: school.id,
              tierId,
              firstName,
              lastName,
              email: accountEmail,
              status: "APPLICANT",
              currentClass: targetGrade,
              parentName: parentName || null,
              parentPhone: parentContact || null,
              parentEmail: parentEmail || null,
              applicantAt: new Date(),
              dynamicFields: {
                password: hashedPassword,
                isTemporaryPassword: isTemporary,
              },
            },
          });
          await setUserMustChangePassword(createdStudent.id, school.id, isTemporary);
        }
      } catch (studentErr: any) {
        if (studentErr?.code === "P2002") {
          console.warn("[public-submit] Student already exists with this email:", accountEmail);
        } else {
          console.warn("[public-submit] Warning while provisioning student account record:", studentErr);
        }
      }
    }

    const trackUrl = `/${school.subdomain || domainCandidate}/admissions/track/${appNo}`;

    // Send Application Received email asynchronously without awaiting (non-blocking)
    const targetRecipient = (studentEmail || parentEmail || "").trim();
    if (targetRecipient) {
      import("@/lib/email-service")
        .then(({ sendApplicationReceivedEmail }) => {
          sendApplicationReceivedEmail({
            schoolId: school.id,
            applicantName,
            applicationNo: appNo,
            targetGrade: effectiveTargetGrade,
            recipientEmail: targetRecipient,
            parentName: parentName || "Parent / Guardian",
            schoolName: school.name,
            subdomain: school.subdomain,
            leadId: newLead.id,
          }).catch((e) => console.log(e));
        })
        .catch((e) => console.log(e));
    }

    // Trigger initial inquiry notification
    try {
      triggerInquiryNotification({
        leadId: newLead.id,
        schoolId: school.id,
        lead: newLead,
        school,
      });
    } catch (notifErr) {
      console.warn("[PUBLIC_SUBMIT] Notification error:", notifErr);
    }

    return NextResponse.json({
      success: true,
      applicationNo: appNo,
      trackUrl,
      appNo,
      redirectUrl: trackUrl,
      trackingUrl: trackUrl,
      lead: newLead,
    });
  } catch (error: any) {
    console.error("Public submission error:", error);
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "An admission inquiry with this contact or email is already registered." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || "Failed to submit application" }, { status: 500 });
  }
}
