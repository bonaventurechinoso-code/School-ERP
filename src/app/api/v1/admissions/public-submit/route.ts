import { NextRequest, NextResponse } from "next/server";
import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { triggerInquiryNotification } from "@/lib/admissions-events";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, validatePasswordStrength } from "@/lib/security-service";
import * as jose from "jose";
import crypto from "crypto";

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

    function deriveTierFromClass(cls: string, fallback?: string): string {
      cls = (cls || "").toLowerCase().trim();
      if (["creche", "playgroup", "pre-nursery", "nursery 1", "nursery 2", "nursery 3", "crèche", "creche"].some((k) => cls.includes(k))) {
        return "Creche / Nursery";
      }
      if (cls.includes("primary") || cls.includes("basic") || cls.includes("elementary")) {
        return "Primary School";
      }
      if (
        cls.includes("jss") ||
        cls.includes("sss") ||
        cls.includes("ss1") ||
        cls.includes("ss 1") ||
        cls.includes("ss2") ||
        cls.includes("ss 2") ||
        cls.includes("ss3") ||
        cls.includes("ss 3") ||
        cls.includes("secondary") ||
        cls.includes("high")
      ) {
        return "Secondary School";
      }
      if (["nd", "hnd", "100 level", "200", "300", "400", "university", "polytechnic", "college of education"].some((k) => cls.includes(k))) {
        return "Higher Institution / University";
      }
      return fallback || "Secondary School";
    }

    const resolvedTargetClass = (data.targetClass || data.targetGrade || data.targetClassCohort || targetGrade || "Class 1").trim();
    const effectiveTargetGrade = resolvedTargetClass;
    const derivedTierName = deriveTierFromClass(effectiveTargetGrade, data.academicTier);

    // Determine intended tier name
    let academicTierName = (data.academicTier || "").trim();
    if (!academicTierName || (derivedTierName !== "Creche / Nursery" && academicTierName.toLowerCase().includes("creche"))) {
      academicTierName = derivedTierName;
    }

    // Match tier in school's AcademicTiers
    let matchedTier = school.academicTiers.find((t) => {
      const tName = t.name.toLowerCase();
      const targetName = academicTierName.toLowerCase();
      return tName === targetName || tName.includes(targetName) || targetName.includes(tName);
    });

    if (!matchedTier && tierId) {
      const explicitTier = school.academicTiers.find((t) => t.id === tierId);
      // If explicit tier is not mismatched with class
      if (explicitTier && !(explicitTier.name.toLowerCase().includes("creche") && derivedTierName === "Secondary School")) {
        matchedTier = explicitTier;
      }
    }

    if (!matchedTier) {
      // Find fallback matching derivedTierName
      matchedTier = school.academicTiers.find((t) => {
        const tName = t.name.toLowerCase();
        const derived = derivedTierName.toLowerCase();
        return tName === derived || tName.includes(derived) || derived.includes(tName);
      }) || school.academicTiers[0];
    }

    const effectiveTierId = matchedTier?.id || tierId || school.academicTiers[0]?.id;
    const finalTierName = matchedTier?.name || academicTierName || derivedTierName;

    console.log("[PUBLIC_SUBMIT] Effective submission payload:", {
      applicantName,
      targetClass: effectiveTargetGrade,
      targetClassCohort: effectiveTargetGrade,
      academicTier: finalTierName,
      effectiveTierId,
    });

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

    const uploadToken = crypto.randomUUID();
    const uploadExpiresAt = new Date();
    uploadExpiresAt.setDate(uploadExpiresAt.getDate() + 30); // 30-day secure upload window

    const fullName = (applicantName || data.fullName || "Student").trim();
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] || "Student";
    const lastName = nameParts.slice(1).join(" ") || "Applicant";

    // 1. SYSTEM ANTI-DUPLICATE GUARD (DEDUPLICATION):
    // Compound validation key: [schoolId + Student Name + Parent Phone/Email]
    const { findDuplicateAdmissionEntry, executeLeadToRegisterTransition } = await import(
      "@/modules/enrollment/enrollment.controller"
    );

    const dupCheck = await findDuplicateAdmissionEntry({
      tenantId: school.id,
      firstName,
      lastName,
      studentName: fullName,
      parentPhone: parentContact || studentPhone || null,
      email: studentEmail || parentEmail || null,
    });

    let newLead: any = dupCheck.leadRecord;

    if (newLead) {
      // Merge incoming payload into active lead to prevent data fracturing
      newLead = await tenantDb.admissionLead.update({
        where: { id: newLead.id },
        data: {
          targetGrade: effectiveTargetGrade,
          studentEmail: studentEmail || newLead.studentEmail,
          studentPhone: studentPhone || newLead.studentPhone,
          parentName: parentName || newLead.parentName,
          parentContact: parentContact || newLead.parentContact,
          parentPhone: parentContact || newLead.parentPhone,
          parentEmail: parentEmail || newLead.parentEmail,
          uploadToken: newLead.uploadToken || uploadToken,
          uploadExpiresAt: newLead.uploadExpiresAt || uploadExpiresAt,
          status: "CONVERTED",
          documents: {
            ...((newLead.documents as any) || {}),
            passwordHash: hashedPassword,
            academicTier: finalTierName,
            targetClass: effectiveTargetGrade,
            targetClassCohort: effectiveTargetGrade,
          },
        },
      });
    } else {
      // Create new lead flagged CONVERTED since bio-data is submitted
      newLead = await tenantDb.admissionLead.create({
        data: {
          schoolId: school.id,
          applicantName: fullName,
          studentEmail,
          studentPhone,
          parentName,
          parentContact: parentContact || "N/A",
          parentPhone: parentContact || null,
          parentEmail,
          tierId: effectiveTierId!,
          targetGrade: effectiveTargetGrade,
          source: "Website",
          status: "CONVERTED",
          uploadToken,
          uploadExpiresAt,
          documents: {
            passwordHash: hashedPassword,
            academicTier: finalTierName,
            targetClass: effectiveTargetGrade,
            targetClassCohort: effectiveTargetGrade,
          },
          logs: [
            {
              timestamp: new Date().toISOString(),
              action: "BIO_DATA_SUBMITTED",
              note: "Bio-data submitted via public application portal. Transitioned to live AdmissionRegister.",
            },
          ],
        },
      });
    }

    // 2. AUTOMATED FUNNEL STATE MACHINE:
    // Millisecond bio-data is submitted, atomically create/merge into live AdmissionRegister (Status: DOCS_PENDING)
    const transitionResult = await executeLeadToRegisterTransition({
      tenantId: school.id,
      leadId: newLead.id,
      bioData: {
        firstName,
        lastName,
        classApplied: effectiveTargetGrade,
        parentPhone: parentContact || studentPhone || "N/A",
        email: studentEmail || parentEmail || null,
        parentName,
      },
      credentials: [
        {
          type: "TIER_INFO",
          docType: "tierInfo",
          name: "Academic Tier Metadata",
          verified: false,
          key: "academicTier",
        },
      ],
      status: "docs_pending",
    });

    let appNo = transitionResult.registerRecord.applicationNo;
    const accountEmail = (studentEmail || parentEmail || "").trim().toLowerCase();

    // 2b. Synchronize with AdmissionsApplication pipeline for Admin Workspace visibility
    // UPSTREAM VALIDATION & DETERMINISTIC COMPOSITE KEY PRE-CHECK:
    // [PUPIL FULL NAME] + [CLASS] + [AGE/DOB] + [CURRENT_SESSION]
    let admissionsApp: any = null;
    try {
      const { findExistingAdmissionsApplication, isInstitutionalApplicationNo } = await import(
        "@/lib/admissions-deduplication.service"
      );

      const defaultDob = data.dateOfBirth
        ? new Date(data.dateOfBirth)
        : new Date(Date.now() - 10 * 365.25 * 24 * 60 * 60 * 1000);
      const currentYear = new Date().getFullYear();
      const currentAcademicSession = currentYear + "/" + (currentYear + 1);

      // Check if an application already exists matching deterministic composite key
      const existingApp = await findExistingAdmissionsApplication({
        schoolId: school.id,
        fullName,
        className: effectiveTargetGrade,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : defaultDob,
        session: currentAcademicSession,
        phoneNumber: parentContact || studentPhone || null,
        email: accountEmail || null,
      });

      if (existingApp) {
        // Upsert / Merge: Do NOT spawn a duplicate row.
        // If the existing application has a temporary number (e.g. APP-7F6950) while the register
        // has an institutional number (e.g. EGEDE/2026/0001), upgrade to the finalized institutional number!
        let canonicalAppNo = existingApp.applicationNumber;
        if (!isInstitutionalApplicationNo(existingApp.applicationNumber) && isInstitutionalApplicationNo(appNo)) {
          canonicalAppNo = appNo;
        } else if (isInstitutionalApplicationNo(existingApp.applicationNumber)) {
          canonicalAppNo = existingApp.applicationNumber;
          appNo = canonicalAppNo;
        }

        admissionsApp = await basePrisma.admissionsApplication.update({
          where: { id: existingApp.id },
          data: {
            applicationNumber: canonicalAppNo,
            programId: effectiveTargetGrade || existingApp.programId,
            email: accountEmail || existingApp.email,
            phoneNumber: parentContact || studentPhone || existingApp.phoneNumber,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : existingApp.dateOfBirth,
            tierSpecificData: {
              ...((existingApp.tierSpecificData as any) || {}),
              targetGrade: effectiveTargetGrade,
              targetClass: effectiveTargetGrade,
              academicTier: finalTierName,
              parentName: parentName || (existingApp.tierSpecificData as any)?.parentName || "Parent / Guardian",
              parentPhone: parentContact || studentPhone || (existingApp.tierSpecificData as any)?.parentPhone || "N/A",
              leadId: newLead.id,
              dateOfBirth: data.dateOfBirth || (existingApp.tierSpecificData as any)?.dateOfBirth || null,
            },
            metadata: {
              ...((existingApp.metadata as any) || {}),
              leadId: newLead.id,
              registerId: transitionResult.registerRecord?.id,
              uploadToken,
            },
          },
        });
        console.log("[PUBLIC_SUBMIT] Deduplicated & Merged into existing AdmissionsApplication record:", admissionsApp.id, canonicalAppNo);
      } else {
        admissionsApp = await basePrisma.admissionsApplication.create({
          data: {
            tenantId: school.id,
            schoolId: school.id,
            academicSessionId: currentAcademicSession,
            programId: effectiveTargetGrade || "Class 1",
            applicationNumber: appNo,
            intakeChannel: "ONLINE_PORTAL",
            firstName,
            lastName,
            email: accountEmail || (appNo.toLowerCase().replace(/[^a-z0-9]/g, "") + "@applicant.schoolerp"),
            phoneNumber: parentContact || studentPhone || "N/A",
            whatsappNumber: parentContact || studentPhone || null,
            dateOfBirth: defaultDob,
            gender: data.gender || "Unspecified",
            status: "PAYMENT_PENDING",
            tierSpecificData: {
              targetGrade: effectiveTargetGrade,
              targetClass: effectiveTargetGrade,
              academicTier: finalTierName,
              parentName: parentName || "Parent / Guardian",
              parentPhone: parentContact || studentPhone || "N/A",
              leadId: newLead.id,
              dateOfBirth: data.dateOfBirth || null,
            },
            metadata: {
              leadId: newLead.id,
              registerId: transitionResult.registerRecord?.id,
              uploadToken,
            },
          },
        });
        console.log("[PUBLIC_SUBMIT] Created new AdmissionsApplication record:", admissionsApp.id, admissionsApp.applicationNumber);
      }
    } catch (appErr: any) {
      console.error("[PUBLIC_SUBMIT] Error creating/updating AdmissionsApplication:", appErr);
    }

    // Provision or sync Student portal user record
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
              tierId: effectiveTierId!,
              currentClass: effectiveTargetGrade,
              dynamicFields: {
                ...currentFields,
                password: hashedPassword,
                isTemporaryPassword: isTemporary,
                academicTier: finalTierName,
                targetClass: effectiveTargetGrade,
                targetClassCohort: effectiveTargetGrade,
              },
            },
          });
          await setUserMustChangePassword(existingStudent.id, school.id, isTemporary);
        } else {
          const nameParts = (applicantName || data.fullName || "Student").trim().split(" ");
          const firstName = nameParts[0] || "Student";
          const lastName = nameParts.slice(1).join(" ") || "Applicant";

          const createdStudent = await tenantDb.student.create({
            data: {
              schoolId: school.id,
              tierId: effectiveTierId!,
              firstName,
              lastName,
              email: accountEmail,
              status: "APPLICANT",
              currentClass: effectiveTargetGrade,
              parentName: parentName || null,
              parentPhone: parentContact || null,
              parentEmail: parentEmail || null,
              applicantAt: new Date(),
              dynamicFields: {
                password: hashedPassword,
                isTemporaryPassword: isTemporary,
                academicTier: finalTierName,
                targetClass: effectiveTargetGrade,
                targetClassCohort: effectiveTargetGrade,
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

    const sub = school.subdomain || domainCandidate;
    const trackUrl = `/${sub}/admissions/track/${encodeURIComponent(appNo)}`;
    const uploadUrl = `/${sub}/admissions/upload/${newLead.id}?token=${uploadToken}`;

    // Send Application Received tracking & upload resume email via Resend
    const targetRecipient = (studentEmail || parentEmail || "").trim();
    if (targetRecipient) {
      try {
        const { sendApplicationReceivedEmail } = await import("@/lib/email-service");
        await sendApplicationReceivedEmail({
          schoolId: school.id,
          applicantName,
          applicationNo: appNo,
          targetGrade: effectiveTargetGrade,
          recipientEmail: targetRecipient,
          parentName: parentName || "Parent / Guardian",
          schoolName: school.name,
          subdomain: school.subdomain,
          leadId: newLead.id,
          uploadToken,
        });
      } catch (mailErr) {
        console.warn("[PUBLIC_SUBMIT] Failed to dispatch tracking email:", mailErr);
      }
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

    // Persist Session for Document Upload:
    // Sign a 24-hour "guest applicant session" token so applicant remains authorized
    // through their document upload stage without forced logout.
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const guestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const sessionTokenId = "guest_" + newLead.id + "_" + Date.now();
    const guestSessionToken = await new jose.SignJWT({
      userId: newLead.id,
      id: newLead.id,
      sessionToken: sessionTokenId,
      sessionId: sessionTokenId,
      jti: sessionTokenId,
      applicationId: admissionsApp?.id || newLead.id,
      applicationNumber: appNo,
      email: accountEmail || undefined,
      tenantId: school.id,
      schoolId: school.id,
      schoolDomain: sub,
      role: "GUEST_APPLICANT",
      staffRole: "GUEST_APPLICANT",
      isGuestApplicant: true,
      mustChangePassword: false,
      leadId: newLead.id,
      uploadToken: uploadToken,
      applicationNo: appNo,
      activeTiers: [finalTierName],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(guestExpiresAt.getTime() / 1000))
      .sign(secret);

    const response = NextResponse.json({
      success: true,
      applicationNo: appNo,
      trackUrl,
      uploadUrl,
      appNo,
      redirectUrl: trackUrl,
      trackingUrl: trackUrl,
      lead: newLead,
      uploadToken,
      sessionToken: guestSessionToken,
    });

    const isSecure = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    };

    response.cookies.set("session", guestSessionToken, cookieOptions);
    response.cookies.set("accessToken", guestSessionToken, cookieOptions);
    response.cookies.set("guest_session", "true", { ...cookieOptions, httpOnly: false });
    response.cookies.set("activeTier", encodeURIComponent(finalTierName), { ...cookieOptions, httpOnly: false });

    return response;
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
