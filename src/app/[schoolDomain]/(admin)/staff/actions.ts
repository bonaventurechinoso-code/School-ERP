"use server";

import { basePrisma, getTenantClient } from "@/lib/tenant-prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { setUserMustChangePassword, validatePasswordStrength } from "@/lib/security-service";
import { cacheAside, buildCacheKey } from "@/lib/cache";
import { executeCursorPagination, CursorPaginationResult } from "@/lib/pagination";
import { invalidateStaffNamespace } from "@/lib/cache-invalidation";
import { clearL1TenantCache } from "@/lib/cache";
import { sendStaffEnrollmentConfirmationEmail } from "@/lib/mail";
import { getSession } from "@/lib/auth";
import { checkRouteAuthorization } from "@/lib/permissions";
import crypto from "crypto";
import { StaffTierCategory, isNonTeachingRole } from "@/lib/staff-roles-config";

function safeRevalidate(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // Graceful no-op in non-HTTP contexts (e.g. testing)
  }
}

/**
 * Safely resolves school identifier whether passed as UUID or subdomain string
 */
export async function resolveSchoolId(schoolIdentifier: string): Promise<string> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolIdentifier);
  if (isUuid) return schoolIdentifier;

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolIdentifier },
    select: { id: true },
  });
  return school?.id || schoolIdentifier;
}

/**
 * Resolves both schoolId and subdomain safely for tenant-specific cache and path revalidation
 */
export async function resolveSchoolInfo(schoolIdentifier: string): Promise<{ schoolId: string; subdomain: string }> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolIdentifier);
  if (isUuid) {
    const school = await basePrisma.school.findUnique({
      where: { id: schoolIdentifier },
      select: { id: true, subdomain: true },
    });
    return {
      schoolId: schoolIdentifier,
      subdomain: school?.subdomain || "",
    };
  }

  const school = await basePrisma.school.findUnique({
    where: { subdomain: schoolIdentifier },
    select: { id: true, subdomain: true },
  });
  return {
    schoolId: school?.id || schoolIdentifier,
    subdomain: school?.subdomain || schoolIdentifier,
  };
}

import { toCanonicalRole } from "./helpers";

/**
 * Ensure the multi-tenant staff metadata table exists for Nigerian TRCN & KYC storage
 */
export async function ensureStaffMetadataTable() {
  try {
    await basePrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bonavee_staff_metadata (
        staff_id TEXT PRIMARY KEY,
        phone TEXT,
        whatsapp TEXT,
        nin TEXT,
        gender TEXT,
        state_of_origin TEXT,
        lga_of_origin TEXT,
        residential_address TEXT,
        qualification TEXT,
        institution TEXT,
        graduation_year TEXT,
        trcn_number TEXT,
        trcn_category TEXT,
        trcn_status TEXT,
        specialization TEXT,
        appointment_type TEXT,
        appointment_date TEXT,
        emergency_name TEXT,
        emergency_phone TEXT,
        designation TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await basePrisma.$executeRawUnsafe(`
      ALTER TABLE bonavee_staff_metadata ADD COLUMN IF NOT EXISTS designation TEXT;
    `).catch(() => {});
  } catch (err) {
    console.error("[ensureStaffMetadataTable] Table check/create error:", err);
  }
}

/**
 * High-performance cursor-based fetching for Staff Directory with Department,
 * Today's Attendance, and Nigerian TRCN/KYC Metadata.
 */
export async function fetchStaffPaginated(
  schoolIdentifier: string,
  options?: {
    role?: string;
    status?: string;
    departmentId?: string;
    cursor?: string | null;
    limit?: number;
    search?: string;
  }
): Promise<CursorPaginationResult<any>> {
  try {
    const schoolInfo = await resolveSchoolInfo(schoolIdentifier);
    const schoolId = schoolInfo.schoolId;

    // Strict session and RBAC authorization verification (validate against subdomain or tenant id)
    const session = await getSession(undefined, schoolInfo.subdomain || schoolId);
    const auth = checkRouteAuthorization("/staff", session?.role, session?.staffRole);
    if (!auth.allowed) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
        limit: options?.limit || 25,
      };
    }

    const role = options?.role;
    const status = options?.status;
    const departmentId = options?.departmentId;
    const cursor = options?.cursor;
    const limit = options?.limit || 25;
    const search = options?.search;

    await ensureStaffMetadataTable().catch(() => {});

    const cacheKey = buildCacheKey({
      tenantId: schoolId,
      table: "staff",
      action: "paginated_enhanced",
      cursor,
      limit,
      filters: { role, status, departmentId, search },
    });

    return await cacheAside<CursorPaginationResult<any>>({
      key: cacheKey,
      ttlSeconds: 900, // 15 minutes safe sliding TTL
      fetchFn: async () => {
        try {
          const tenantDb = getTenantClient(schoolId);
          const whereClause: any = {
            schoolId,
            ...(status && status !== "ALL" ? { status } : {}),
            ...(role && role !== "ALL"
              ? role.toUpperCase().includes("NON")
                ? { user: { role: { not: "TEACHER" } } }
                : role.toUpperCase().includes("TEACH")
                ? { user: { role: "TEACHER" } }
                : { user: { role: toCanonicalRole(role) } }
              : {}),
            ...(departmentId && departmentId !== "ALL" ? { departmentId } : {}),
          };

          if (search && search.trim()) {
            const query = search.trim();
            whereClause.OR = [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ];
          }

          // Today's date range for attendance check
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const paginatedResult = await executeCursorPagination(async (args) => {
            return tenantDb.staff.findMany({
              ...args,
              where: whereClause,
              orderBy: { createdAt: "desc" },
              include: { 
                department: true,
                user: {
                  select: {
                    id: true,
                    role: true,
                    email: true,
                    mustChangePassword: true,
                    status: true,
                  }
                },
                StaffAttendance: {
                  where: {
                    date: {
                      gte: todayStart,
                      lte: todayEnd,
                    }
                  },
                  take: 1,
                },
                PayrollRecord: {
                  orderBy: { payDate: "desc" },
                  take: 1,
                }
              },
            });
          }, { cursor, limit });

          // Augment items with metadata from bonavee_staff_metadata
          const items = paginatedResult.items || [];
          const staffIds = items.map((s: any) => s.id);
          const metadataMap: Record<string, any> = {};

          if (staffIds.length > 0) {
            try {
              const rows: any[] = await basePrisma.$queryRawUnsafe(`
                SELECT * FROM bonavee_staff_metadata WHERE staff_id = ANY($1::text[])
              `, staffIds);
              rows.forEach((r: any) => {
                metadataMap[r.staff_id] = r;
              });
            } catch {
              // Graceful fallback if table query fails
            }
          }

          const enhancedItems = items.map((staff: any) => ({
            ...staff,
            role: metadataMap[staff.id]?.designation || staff.user?.role || "TEACHER",
            metadata: metadataMap[staff.id] || null,
            todayAttendance: staff.StaffAttendance?.[0] || null,
            latestPayroll: staff.PayrollRecord?.[0] || null,
          }));

          return {
            ...paginatedResult,
            items: enhancedItems,
          };
        } catch (fetchErr) {
          console.error("[fetchStaffPaginated:fetchFn] Inner query error:", fetchErr);
          return {
            items: [],
            nextCursor: null,
            hasMore: false,
            limit: options?.limit || 25,
          };
        }
      },
    });
  } catch (error) {
    console.error("[fetchStaffPaginated] Outer handler exception:", error);
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
      limit: options?.limit || 25,
    };
  }
}

/**
 * Fetch full staff profile dossier including metadata, department,
 * attendance records, and recent payroll slips.
 */
export async function fetchStaffFullProfile(schoolIdentifier: string, staffId: string) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);

    // Strict session and RBAC authorization verification
    const session = await getSession(undefined, schoolId);
    const auth = checkRouteAuthorization("/staff", session?.role, session?.staffRole);
    if (!auth.allowed) {
      return { success: false, error: "Access Denied: Administrative privileges required to view personnel profiles." };
    }

    const tenantDb = getTenantClient(schoolId);
    await ensureStaffMetadataTable();

    const staff = await tenantDb.staff.findUnique({
      where: { id: staffId },
      include: {
        department: true,
        user: {
          select: {
            id: true,
            role: true,
            email: true,
          },
        },
        PayrollRecord: {
          orderBy: { payDate: "desc" },
          take: 12,
        },
        StaffAttendance: {
          orderBy: { date: "desc" },
          take: 14,
        },
      }
    });

    if (!staff) {
      return { success: false, error: "Staff record not found." };
    }

    let metadata: any = null;
    try {
      const rows: any[] = await basePrisma.$queryRawUnsafe(`
        SELECT * FROM bonavee_staff_metadata WHERE staff_id = $1 LIMIT 1
      `, staffId);
      if (rows.length > 0) {
        metadata = rows[0];
      }
    } catch {
      // Graceful fallback
    }

    // Calculate 30-day attendance turnout stats
    const totalMarked = staff.StaffAttendance.length;
    const presentCount = staff.StaffAttendance.filter((a: any) => a.status === "PRESENT").length;
    const lateCount = staff.StaffAttendance.filter((a: any) => a.status === "LATE").length;
    const attendanceRate = totalMarked > 0 ? Math.round(((presentCount + lateCount * 0.5) / totalMarked) * 100) : 100;

    return {
      success: true,
      data: {
        ...staff,
        role: metadata?.designation || staff.user?.role || "TEACHER",
        metadata,
        stats: {
          totalMarked,
          presentCount,
          lateCount,
          attendanceRate,
        }
      }
    };
  } catch (error: any) {
    console.error("[fetchStaffFullProfile] Error:", error);
    return { success: false, error: error.message || "Failed to load staff profile." };
  }
}

/**
 * Create new staff member with optional department, remuneration, bank details, and TRCN metadata
 */
export async function createStaff(
  schoolIdentifier: string,
  data: { 
    firstName: string; 
    lastName: string; 
    email: string; 
    role: string; 
    status?: string;
    departmentId?: string | null;
    baseSalary?: number | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    accountName?: string | null;
    // Metadata fields
    phone?: string;
    whatsapp?: string;
    nin?: string;
    gender?: string;
    stateOfOrigin?: string;
    lgaOfOrigin?: string;
    residentialAddress?: string;
    qualification?: string;
    institution?: string;
    graduationYear?: string;
    trcnNumber?: string;
    trcnCategory?: string;
    trcnStatus?: string;
    specialization?: string;
    appointmentType?: string;
    emergencyName?: string;
    emergencyPhone?: string;
    password?: string;
  }
) {
  try {
    const { schoolId, subdomain } = await resolveSchoolInfo(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);
    await ensureStaffMetadataTable();

    let staffPasswordToSave = "Welcome123";
    let isTemporary = true;

    if (data.password && typeof data.password === "string" && data.password.trim().length > 0) {
      const validation = validatePasswordStrength(data.password.trim());
      if (!validation.valid) {
        return { success: false, error: validation.error || "Password does not meet complexity requirements." };
      }
      staffPasswordToSave = data.password.trim();
      isTemporary = false;
    }

    const hashedPassword = await bcrypt.hash(staffPasswordToSave, 12);

    const timestampData: any = {};
    const status = data.status || "ONBOARDING";
    if (status === "ONBOARDING") timestampData.onboardingAt = new Date();
    if (status === "ACTIVE") timestampData.activeAt = new Date();

    if (data.bankAccountNumber && data.bankAccountNumber.trim()) {
      const cleanNuban = data.bankAccountNumber.trim();
      if (!/^\d{10}$/.test(cleanNuban)) {
        return { success: false, error: "NUBAN account number must be exactly 10 numerical digits." };
      }
    }

    const canonicalRole = toCanonicalRole(data.role);

    // Upsert into User table with mustChangePassword = true
    const user = await basePrisma.user.upsert({
      where: { schoolId_email: { schoolId, email: data.email.trim().toLowerCase() } },
      update: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: canonicalRole,
        passwordHash: hashedPassword,
        mustChangePassword: true,
        status: status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      },
      create: {
        schoolId,
        email: data.email.trim().toLowerCase(),
        passwordHash: hashedPassword,
        mustChangePassword: true,
        role: canonicalRole,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        status: status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      },
    });

    const staff = await tenantDb.staff.create({
      data: {
        schoolId,
        userId: user.id,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        status,
        departmentId: data.departmentId || null,
        baseSalary: data.baseSalary ? Number(data.baseSalary) : null,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        accountName: data.accountName || null,
        ...timestampData,
      }
    });

    // Save metadata if any provided
    if (data.phone || data.trcnNumber || data.qualification || data.nin || data.whatsapp) {
      await basePrisma.$executeRawUnsafe(`
        INSERT INTO bonavee_staff_metadata (
          staff_id, phone, whatsapp, nin, gender, state_of_origin, lga_of_origin,
          residential_address, qualification, institution, graduation_year,
          trcn_number, trcn_category, trcn_status, specialization, appointment_type,
          emergency_name, emergency_phone, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW()
        )
        ON CONFLICT (staff_id) DO UPDATE SET
          phone = EXCLUDED.phone,
          whatsapp = EXCLUDED.whatsapp,
          nin = EXCLUDED.nin,
          gender = EXCLUDED.gender,
          state_of_origin = EXCLUDED.state_of_origin,
          lga_of_origin = EXCLUDED.lga_of_origin,
          residential_address = EXCLUDED.residential_address,
          qualification = EXCLUDED.qualification,
          institution = EXCLUDED.institution,
          graduation_year = EXCLUDED.graduation_year,
          trcn_number = EXCLUDED.trcn_number,
          trcn_category = EXCLUDED.trcn_category,
          trcn_status = EXCLUDED.trcn_status,
          specialization = EXCLUDED.specialization,
          appointment_type = EXCLUDED.appointment_type,
          emergency_name = EXCLUDED.emergency_name,
          emergency_phone = EXCLUDED.emergency_phone,
          updated_at = NOW();
      `, 
        staff.id,
        data.phone || null,
        data.whatsapp || null,
        data.nin || null,
        data.gender || null,
        data.stateOfOrigin || null,
        data.lgaOfOrigin || null,
        data.residentialAddress || null,
        data.qualification || null,
        data.institution || null,
        data.graduationYear || null,
        data.trcnNumber || null,
        data.trcnCategory || "Category C",
        data.trcnStatus || "REGISTERED",
        data.specialization || null,
        data.appointmentType || "FULL_TIME",
        data.emergencyName || null,
        data.emergencyPhone || null
      );
    }

    await invalidateStaffNamespace(schoolId);
    safeRevalidate(`/[schoolDomain]/staff`, "page");

    // Dispatch enrollment confirmation email to staff member
    try {
      const emailResult = await sendStaffEnrollmentConfirmationEmail({
        schoolId,
        staffId: staff.id,
        staffName: `${data.firstName.trim()} ${data.lastName.trim()}`,
        staffEmail: data.email.trim().toLowerCase(),
        role: canonicalRole,
        departmentId: data.departmentId || null,
        temporaryPassword: isTemporary ? staffPasswordToSave : undefined,
      });
      if (!emailResult.success) {
        console.error(`[EMAIL_SYNC_ERROR] [STAFF_ENROLLMENT] Delivery failure for staff ${staff.id}:`, emailResult.error);
      }
    } catch (emailErr) {
      console.error("[EMAIL_SYNC_ERROR] [STAFF_ENROLLMENT] Staff enrollment confirmation error in createStaff:", emailErr);
    }

    return { success: true, data: staff };
  } catch (error: any) {
    console.error("[createStaff] Failed to create staff:", error);
    return { success: false, error: error.message || "Failed to create staff member." };
  }
}

/**
 * Atomically update staff profile credentials, compensation, and TRCN metadata
 */
export async function updateStaffProfile(
  schoolIdentifier: string,
  staffId: string,
  data: {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    role: string;
    status?: string;
    departmentId?: string | null;
    baseSalary?: number | null;
    payGrade?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    accountName?: string | null;
    // Metadata fields
    phone?: string;
    whatsapp?: string;
    nin?: string;
    gender?: string;
    dateOfBirth?: string;
    maritalStatus?: string;
    stateOfOrigin?: string;
    lgaOfOrigin?: string;
    residentialAddress?: string;
    qualification?: string;
    institution?: string;
    graduationYear?: string;
    fieldOfStudy?: string;
    specialization?: string;
    trcnNumber?: string;
    trcnCategory?: string;
    trcnStatus?: string;
    professionalBody?: string;
    professionalMembershipNo?: string;
    appointmentType?: string;
    appointmentDate?: string;
    emergencyName?: string;
    emergencyPhone?: string;
    assignedClass?: string;
    assignedSubjects?: string;
    faculty?: string;
    pensionRsa?: string;
    pensionProvider?: string;
    tin?: string;
  }
) {
  try {
    const { schoolId, subdomain } = await resolveSchoolInfo(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);
    await ensureStaffMetadataTable();

    if (data.bankAccountNumber && data.bankAccountNumber.trim()) {
      const cleanNuban = data.bankAccountNumber.trim();
      if (!/^\d{10}$/.test(cleanNuban)) {
        return { success: false, error: "NUBAN account number must be exactly 10 numerical digits." };
      }
    }

    const staffRec = await tenantDb.staff.findUnique({
      where: { id: staffId },
      select: { id: true, userId: true },
    });

    const canonicalRole = toCanonicalRole(data.role);
    if (staffRec?.userId) {
      await basePrisma.user.update({
        where: { id: staffRec.userId },
        data: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email.trim().toLowerCase(),
          role: canonicalRole,
        }
      }).catch(() => {});
    }

    const updateData: any = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim().toLowerCase(),
      departmentId: data.departmentId || null,
      baseSalary: data.baseSalary !== undefined && data.baseSalary !== null ? Number(data.baseSalary) : null,
      bankName: data.bankName || null,
      bankAccountNumber: data.bankAccountNumber || null,
      accountName: data.accountName || null,
    };

    if (data.role) updateData.academicRank = data.role;
    if (data.middleName) updateData.middleName = data.middleName.trim();
    if (data.gender) updateData.gender = data.gender;
    if (data.phone) updateData.phone = data.phone.trim();
    if (data.nin) updateData.nin = data.nin.trim();
    if (data.maritalStatus) updateData.maritalStatus = data.maritalStatus;
    if (data.stateOfOrigin) updateData.state = data.stateOfOrigin.trim();
    if (data.lgaOfOrigin) updateData.lga = data.lgaOfOrigin.trim();
    if (data.residentialAddress) updateData.residentialAddress = data.residentialAddress.trim();
    if (data.qualification) updateData.highestQualification = data.qualification;
    if (data.institution) updateData.institutionAttended = data.institution.trim();
    if (data.graduationYear) updateData.yearGraduated = data.graduationYear;
    if (data.fieldOfStudy) updateData.fieldOfStudy = data.fieldOfStudy.trim();
    if (data.specialization) updateData.specialization = data.specialization.trim();
    if (data.trcnNumber !== undefined) updateData.trcnNumber = data.trcnNumber ? data.trcnNumber.trim() : null;
    if (data.trcnStatus) updateData.trcnStatus = data.trcnStatus;
    if (data.professionalBody) updateData.professionalBody = data.professionalBody;
    if (data.professionalMembershipNo) updateData.professionalMembershipNo = data.professionalMembershipNo.trim();
    if (data.payGrade !== undefined) updateData.payGrade = data.payGrade || null;
    if (data.appointmentType) updateData.employmentType = data.appointmentType;
    if (data.pensionRsa !== undefined) updateData.pensionRsa = data.pensionRsa || null;
    if (data.pensionProvider !== undefined) updateData.pensionProvider = data.pensionProvider || null;
    if (data.tin !== undefined) updateData.tin = data.tin || null;

    if (data.status) {
      updateData.status = data.status;
      if (data.status === "ACTIVE") updateData.activeAt = new Date();
      if (data.status === "LEAVE") updateData.leaveAt = new Date();
      if (data.status === "OFFBOARDED") updateData.offboardedAt = new Date();
      if (data.status === "TERMINATED") updateData.terminatedAt = new Date();
    }

    await tenantDb.staff.update({
      where: { id: staffId },
      data: updateData,
    });

    // Upsert metadata record
    await basePrisma.$executeRawUnsafe(`
      INSERT INTO bonavee_staff_metadata (
        staff_id, phone, whatsapp, nin, gender, state_of_origin, lga_of_origin,
        residential_address, qualification, institution, graduation_year,
        trcn_number, trcn_category, trcn_status, specialization, appointment_type,
        appointment_date, emergency_name, emergency_phone, designation, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
      )
      ON CONFLICT (staff_id) DO UPDATE SET
        phone = EXCLUDED.phone,
        whatsapp = EXCLUDED.whatsapp,
        nin = EXCLUDED.nin,
        gender = EXCLUDED.gender,
        state_of_origin = EXCLUDED.state_of_origin,
        lga_of_origin = EXCLUDED.lga_of_origin,
        residential_address = EXCLUDED.residential_address,
        qualification = EXCLUDED.qualification,
        institution = EXCLUDED.institution,
        graduation_year = EXCLUDED.graduation_year,
        trcn_number = EXCLUDED.trcn_number,
        trcn_category = EXCLUDED.trcn_category,
        trcn_status = EXCLUDED.trcn_status,
        specialization = EXCLUDED.specialization,
        appointment_type = EXCLUDED.appointment_type,
        appointment_date = EXCLUDED.appointment_date,
        emergency_name = EXCLUDED.emergency_name,
        emergency_phone = EXCLUDED.emergency_phone,
        designation = EXCLUDED.designation,
        updated_at = NOW();
    `,
      staffId,
      data.phone || null,
      data.whatsapp || null,
      data.nin || null,
      data.gender || null,
      data.stateOfOrigin || null,
      data.lgaOfOrigin || null,
      data.residentialAddress || null,
      data.qualification || null,
      data.institution || null,
      data.graduationYear || null,
      data.trcnNumber || null,
      data.trcnCategory || "Category C",
      data.trcnStatus || "REGISTERED",
      data.specialization || null,
      data.appointmentType || "FULL_TIME",
      data.appointmentDate || null,
      data.emergencyName || null,
      data.emergencyPhone || null,
      data.role || null
    );

    await invalidateStaffNamespace(schoolId);
    if (subdomain) {
      clearL1TenantCache(subdomain);
      safeRevalidate(`/${subdomain}/staff`, "page");
      safeRevalidate(`/${subdomain}/staff`, "layout");
      safeRevalidate(`/${subdomain}/portal/staff`, "page");
      safeRevalidate(`/${subdomain}/portal/staff`, "layout");
      safeRevalidate(`/${subdomain}/dashboard`, "page");
    }
    safeRevalidate(`/teacher/profile`, "page");
    safeRevalidate(`/teacher`, "page");
    safeRevalidate(`/[schoolDomain]/staff`, "page");
    safeRevalidate(`/[schoolDomain]/portal/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[updateStaffProfile] Error:", error);
    return { success: false, error: error.message || "Failed to update staff profile." };
  }
}

/**
 * Standard legacy update for backwards compatibility
 */
export async function updateStaff(
  schoolIdentifier: string,
  staffId: string,
  data: { firstName: string; lastName: string; email: string; role: string; status?: string }
) {
  return updateStaffProfile(schoolIdentifier, staffId, data);
}

export async function deleteStaff(schoolIdentifier: string, staffId: string) {
  try {
    const { schoolId, subdomain } = await resolveSchoolInfo(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);
    
    await tenantDb.staff.delete({
      where: { id: staffId }
    });

    // Cleanup metadata
    try {
      await basePrisma.$executeRawUnsafe(`DELETE FROM bonavee_staff_metadata WHERE staff_id = $1`, staffId);
    } catch {
      // non-blocking
    }

    await invalidateStaffNamespace(schoolId);
    if (subdomain) {
      clearL1TenantCache(subdomain);
      safeRevalidate(`/${subdomain}/staff`, "page");
      safeRevalidate(`/${subdomain}/staff`, "layout");
      safeRevalidate(`/${subdomain}/portal/staff`, "page");
      safeRevalidate(`/${subdomain}/portal/staff`, "layout");
      safeRevalidate(`/${subdomain}/dashboard`, "page");
    }
    safeRevalidate(`/teacher/profile`, "page");
    safeRevalidate(`/teacher`, "page");
    safeRevalidate(`/[schoolDomain]/staff`, "page");
    safeRevalidate(`/[schoolDomain]/portal/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteStaff] Failed to delete staff:", error);
    return { success: false, error: error.message || "Failed to delete staff." };
  }
}

export async function updateStaffStatus(
  schoolIdentifier: string,
  staffId: string,
  newStatus: string
) {
  try {
    const { schoolId, subdomain } = await resolveSchoolInfo(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);
    const data: any = { status: newStatus };
    
    switch (newStatus) {
      case "ONBOARDING":
        data.onboardingAt = new Date();
        break;
      case "ACTIVE":
        data.activeAt = new Date();
        break;
      case "LEAVE":
        data.leaveAt = new Date();
        break;
      case "OFFBOARDED":
        data.offboardedAt = new Date();
        break;
      case "TERMINATED":
        data.terminatedAt = new Date();
        break;
    }

    await tenantDb.staff.update({
      where: { id: staffId },
      data
    });

    await invalidateStaffNamespace(schoolId);
    if (subdomain) {
      clearL1TenantCache(subdomain);
      safeRevalidate(`/${subdomain}/staff`, "page");
      safeRevalidate(`/${subdomain}/staff`, "layout");
      safeRevalidate(`/${subdomain}/portal/staff`, "page");
      safeRevalidate(`/${subdomain}/portal/staff`, "layout");
      safeRevalidate(`/${subdomain}/dashboard`, "page");
    }
    safeRevalidate(`/teacher/profile`, "page");
    safeRevalidate(`/teacher`, "page");
    safeRevalidate(`/[schoolDomain]/staff`, "page");
    safeRevalidate(`/[schoolDomain]/portal/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[updateStaffStatus] Error:", error);
    return { success: false, error: error.message || "Failed to update staff status." };
  }
}

/**
 * 1-Click Server Action: Quick mark today's staff attendance
 */
export async function markStaffQuickAttendanceAction(
  schoolIdentifier: string,
  staffId: string,
  status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT",
  notes?: string
) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await tenantDb.staffAttendance.upsert({
      where: {
        schoolId_staffId_date: {
          schoolId,
          staffId,
          date: today,
        }
      },
      update: {
        status,
        notes: notes || null,
      },
      create: {
        schoolId,
        staffId,
        date: today,
        status,
        notes: notes || null,
      }
    });

    await invalidateStaffNamespace(schoolId);
    safeRevalidate(`/[schoolDomain]/staff`, "page");
    return { success: true, data: record };
  } catch (error: any) {
    console.error("[markStaffQuickAttendanceAction] Error:", error);
    return { success: false, error: error.message || "Failed to mark staff attendance." };
  }
}

/**
 * Department Management Actions
 */
export async function createStaffDepartmentAction(
  schoolIdentifier: string,
  name: string,
  tierId?: string | null
) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: "Department name is required." };

    const dept = await basePrisma.department.create({
      data: {
        schoolId,
        name: trimmed,
        tierId: tierId || null,
      }
    });

    safeRevalidate(`/[schoolDomain]/staff`, "page");
    return { success: true, data: dept };
  } catch (error: any) {
    console.error("[createStaffDepartmentAction] Error:", error);
    return { success: false, error: error.message || "Failed to create department." };
  }
}

export async function deleteStaffDepartmentAction(
  schoolIdentifier: string,
  departmentId: string
) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    const staffCount = await basePrisma.staff.count({
      where: { schoolId, departmentId }
    });

    if (staffCount > 0) {
      return {
        success: false,
        error: `Cannot delete department: ${staffCount} staff member(s) are currently assigned to it. Please reassign them first.`
      };
    }

    await basePrisma.department.delete({
      where: { id: departmentId }
    });

    safeRevalidate(`/[schoolDomain]/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[deleteStaffDepartmentAction] Error:", error);
    return { success: false, error: error.message || "Failed to delete department." };
  }
}

/**
 * Generate Payroll Voucher record directly from Staff Dossier
 */
export async function generateStaffPayrollVoucherAction(
  schoolIdentifier: string,
  staffId: string,
  amount: number,
  payDateStr?: string
) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    if (!amount || isNaN(amount) || amount <= 0) {
      return { success: false, error: "Please specify a valid remuneration amount." };
    }

    const payDate = payDateStr ? new Date(payDateStr) : new Date();
    const periodPrefix = `${payDate.getFullYear()}${(payDate.getMonth() + 1).toString().padStart(2, "0")}`;
    const receiptCode = `VOUCH-${periodPrefix}-${Date.now().toString(36).toUpperCase()}`;

    const record = await basePrisma.payrollRecord.create({
      data: {
        schoolId,
        staffId,
        amount: Number(amount),
        status: "PENDING",
        payDate,
        receiptCode,
      }
    });

    await invalidateStaffNamespace(schoolId);
    safeRevalidate(`/[schoolDomain]/staff`, "page");
    return { success: true, data: record };
  } catch (error: any) {
    console.error("[generateStaffPayrollVoucherAction] Error:", error);
    return { success: false, error: error.message || "Failed to generate payroll voucher." };
  }
}

/**
 * Update Payroll Voucher Status (e.g. PENDING -> DISBURSED / PAID)
 */
export async function updatePayrollVoucherStatusAction(
  schoolIdentifier: string,
  voucherId: string,
  status: "PENDING" | "DISBURSED" | "PAID"
) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);

    const updated = await tenantDb.payrollRecord.update({
      where: { id: voucherId },
      data: {
        status,
        updatedAt: new Date(),
      },
    });

    await invalidateStaffNamespace(schoolId);
    safeRevalidate(`/[schoolDomain]/staff`, "page");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("[updatePayrollVoucherStatusAction] Error:", error);
    return { success: false, error: error.message || "Failed to update voucher status." };
  }
}

/**
 * Delete a draft/erroneous Payroll Voucher record
 */
export async function deletePayrollVoucherAction(
  schoolIdentifier: string,
  voucherId: string
) {
  try {
    const { schoolId, subdomain } = await resolveSchoolInfo(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);

    await tenantDb.payrollRecord.delete({
      where: { id: voucherId },
    });

    await invalidateStaffNamespace(schoolId);
    if (subdomain) {
      clearL1TenantCache(subdomain);
      safeRevalidate(`/${subdomain}/staff`, "page");
      safeRevalidate(`/${subdomain}/staff`, "layout");
      safeRevalidate(`/${subdomain}/portal/staff`, "page");
      safeRevalidate(`/${subdomain}/portal/staff`, "layout");
      safeRevalidate(`/${subdomain}/dashboard`, "page");
    }
    safeRevalidate(`/teacher/profile`, "page");
    safeRevalidate(`/teacher`, "page");
    safeRevalidate(`/[schoolDomain]/staff`, "page");
    safeRevalidate(`/[schoolDomain]/portal/staff`, "page");
    return { success: true };
  } catch (error: any) {
    console.error("[deletePayrollVoucherAction] Error:", error);
    return { success: false, error: error.message || "Failed to delete voucher." };
  }
}

/**
 * Fetch active classes / sections for school onboarding dropdowns
 */
export async function fetchSchoolClassesAction(schoolIdentifier: string) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);
    let classrooms = await tenantDb.classroom.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        tierId: true,
        tier: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }).catch(() => []);

    if (!classrooms || classrooms.length === 0) {
      classrooms = await basePrisma.classroom.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          tierId: true,
          tier: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      }).catch(() => []);
    }

    return { success: true, data: classrooms || [] };
  } catch (error: any) {
    console.error("[fetchSchoolClassesAction] Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Fetch active subjects / courses for school onboarding dropdowns
 */
export async function fetchSchoolSubjectsAction(schoolIdentifier: string) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    const tenantDb = getTenantClient(schoolId);
    const courses = await tenantDb.course.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        code: true,
        tierId: true,
        tier: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return { success: true, data: courses };
  } catch (error: any) {
    console.error("[fetchSchoolSubjectsAction] Error:", error);
    return { success: false, data: [] };
  }
}

/**
 * Idempotent, sequential Staff ID generator
 * Format: SchoolCode + RolePrefix + Sequential
 * Example: EGD/STF/001, APX/LEC/001, APX/STF/001
 */
export async function generateEnterpriseStaffId(
  schoolIdentifier: string,
  role: string,
  tierCategory: StaffTierCategory
): Promise<string> {
  const { schoolId, subdomain } = await resolveSchoolInfo(schoolIdentifier);
  const school = await basePrisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, subdomain: true },
  });

  let schoolCode = "STF";
  const sub = (subdomain || school?.subdomain || "").toUpperCase();
  if (sub === "EGEDE") schoolCode = "EGD";
  else if (sub === "DEMO") schoolCode = "APX";
  else if (sub === "SANDBOX") schoolCode = "TSA";
  else if (sub.length >= 3) schoolCode = sub.slice(0, 3);
  else if (school?.name) {
    const words = school.name.trim().split(/\s+/);
    if (words.length >= 3) {
      schoolCode = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    } else {
      schoolCode = school.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
    }
  }

  // Academic role prefix for Tertiary
  const isTertiaryAcademic =
    tierCategory === "TERTIARY" &&
    !isNonTeachingRole(role) &&
    (role.toLowerCase().includes("lecturer") ||
     role.toLowerCase().includes("professor") ||
     role.toLowerCase().includes("reader") ||
     role.toLowerCase().includes("assistant") ||
     role.toLowerCase().includes("graduate"));

  const rolePrefix = isTertiaryAcademic ? "LEC" : "STF";
  const prefix = `${schoolCode}/${rolePrefix}/`;

  // Find max existing sequential number with this prefix
  const existingStaff = await basePrisma.staff.findMany({
    where: {
      schoolId,
      staffId: { startsWith: prefix },
    },
    select: { staffId: true },
  });

  let maxNum = 0;
  for (const s of existingStaff) {
    if (s.staffId) {
      const parts = s.staffId.split("/");
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last) && last > maxNum) {
        maxNum = last;
      }
    }
  }

  const nextSeq = String(maxNum + 1).padStart(3, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Fetch staff members for Line Manager dropdown
 */
export async function fetchSchoolStaffMembersAction(schoolIdentifier: string) {
  try {
    const schoolId = await resolveSchoolId(schoolIdentifier);
    const staff = await basePrisma.staff.findMany({
      where: { schoolId, status: { in: ["ACTIVE", "ONBOARDING"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        staffId: true,
        user: { select: { role: true } },
      },
      orderBy: { lastName: "asc" },
    });
    return { success: true, data: staff };
  } catch (err: any) {
    console.error("[fetchSchoolStaffMembersAction] Error:", err);
    return { success: false, data: [] };
  }
}

export interface EnterpriseStaffPayload {
  tierCategory: StaffTierCategory;
  
  // Section A: Personal & Identity
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus?: string;
  phone: string;
  email: string;
  residentialAddress: string;
  state: string;
  lga: string;
  nin?: string;
  passportUrl?: string;

  // Section B: Employment
  staffId?: string;
  dateOfEmployment: string;
  employmentType: string;
  departmentName?: string;
  departmentId?: string | null;
  reportingToId?: string | null;
  status?: string;

  // Section C: Qualification & Compliance
  highestQualification: string;
  fieldOfStudy?: string;
  institutionAttended?: string;
  yearGraduated?: string;
  trcnNumber?: string;
  trcnExpiry?: string;
  trcnStatus?: string;
  professionalBody?: string;
  professionalMembershipNo?: string;
  professionalExpiry?: string;
  specialization?: string;
  academicRank?: string;
  cvUrl?: string;
  certificates?: string;

  // Section D: Next of Kin & Emergency
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinAddress?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  guarantorName?: string;
  guarantorPhone?: string;

  // Section E: Payroll & Statutory
  baseSalary: number;
  payGrade?: string;
  bankName?: string;
  bankAccountNumber?: string;
  accountName?: string;
  pensionRsa?: string;
  pensionProvider?: string;
  nhisNo?: string;
  tin?: string;
  paymentMethod?: string;

  // Section F: Account & Access
  role: string;

  // Section G: Assignments (Tier-specific)
  assignments: {
    assignmentType: string;
    classroomId?: string;
    courseId?: string;
    faculty?: string;
    department?: string;
    programme?: string;
    metadata?: Record<string, any>;
  }[];
}

export async function createEnterpriseStaffAction(
  schoolIdentifier: string,
  payload: EnterpriseStaffPayload
) {
  try {
    const { schoolId, subdomain } = await resolveSchoolInfo(schoolIdentifier);

    // 1. Mandatory Validations
    if (!payload.firstName?.trim()) return { success: false, error: "First Name is required." };
    if (!payload.lastName?.trim()) return { success: false, error: "Last Name is required." };
    if (!payload.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) {
      return { success: false, error: "A valid Email address is required." };
    }
    if (!payload.phone?.trim()) return { success: false, error: "Phone number is required." };
    if (!payload.residentialAddress?.trim()) return { success: false, error: "Residential Address is required." };
    if (!payload.state?.trim()) return { success: false, error: "State is required." };
    if (!payload.lga?.trim()) return { success: false, error: "LGA is required." };
    if (!payload.role?.trim()) return { success: false, error: "Role is required." };
    if (!payload.dateOfEmployment) return { success: false, error: "Resumption Date is required." };
    if (!payload.highestQualification?.trim()) return { success: false, error: "Highest Qualification is required." };
    if (!payload.nextOfKinName?.trim()) return { success: false, error: "Next of Kin Name is required." };
    if (!payload.nextOfKinPhone?.trim()) return { success: false, error: "Next of Kin Phone is required." };

    // 2. Date of Birth age validation (>= 18, <= 70)
    if (!payload.dateOfBirth) return { success: false, error: "Date of Birth is required." };
    const dob = new Date(payload.dateOfBirth);
    if (isNaN(dob.getTime())) return { success: false, error: "Invalid Date of Birth." };
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    if (age < 18) return { success: false, error: `Staff must be at least 18 years old (Current age: ${age}).` };
    if (age > 70) return { success: false, error: `Staff age cannot exceed 70 years (Current age: ${age}).` };

    // 3. Resumption Date cannot be in future
    const resumptionDate = new Date(payload.dateOfEmployment);
    if (resumptionDate > today) {
      return { success: false, error: "Date of Employment / Resumption Date cannot be in the future." };
    }

    // 4. NIN validation (must be 11 digits if provided)
    if (payload.nin?.trim()) {
      const cleanNin = payload.nin.trim().replace(/\D/g, "");
      if (cleanNin.length !== 11) {
        return { success: false, error: "National Identity Number (NIN) must be exactly 11 numerical digits." };
      }
    }

    // 5. NUBAN validation & Bank Name required if Salary > 0 or Account provided
    const salaryNum = Number(payload.baseSalary) || 0;
    if (payload.bankAccountNumber?.trim() || salaryNum > 0) {
      const cleanNuban = (payload.bankAccountNumber || "").trim().replace(/\D/g, "");
      if (cleanNuban.length !== 10) {
        return { success: false, error: "NUBAN Account Number must be exactly 10 numerical digits." };
      }
      if (!payload.bankName?.trim()) {
        return { success: false, error: "Bank Name is required when Account Number or Salary is provided." };
      }
    }

    // 6. TRCN Rule per Tier
    const isTeaching = !isNonTeachingRole(payload.role);
    if (isTeaching && (payload.tierCategory === "PRIMARY" || payload.tierCategory === "SECONDARY")) {
      if (!payload.trcnNumber?.trim()) {
        return {
          success: false,
          error: `TRCN License / Registration Number is mandatory for ${payload.tierCategory} teachers under Nigerian educational regulations.`,
        };
      }
    }

    // 7. Teaching vs Non-Teaching Assignment Rules
    if (isTeaching) {
      if (!payload.assignments || payload.assignments.length === 0) {
        return {
          success: false,
          error: "Teaching staff must have at least one teaching unit / class / course assigned before onboarding.",
        };
      }
    } else {
      if (payload.assignments && payload.assignments.length > 0) {
        payload.assignments = [];
      }
    }

    // 8. Unique Email Check per school
    const normalizedEmail = payload.email.trim().toLowerCase();
    const existingStaffEmail = await basePrisma.staff.findFirst({
      where: { schoolId, email: normalizedEmail },
    });
    if (existingStaffEmail) {
      return { success: false, error: `A staff member with email "${normalizedEmail}" already exists in this institution.` };
    }

    // 9. Auto-generate sequential Staff ID
    const assignedStaffId = payload.staffId?.trim() || await generateEnterpriseStaffId(schoolId, payload.role, payload.tierCategory);

    // 10. Server-side cryptographically secure password generation
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let tempPassword = "";
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(crypto.randomInt(0, chars.length));
    }
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const canonicalRole = toCanonicalRole(payload.role);

    // 11. Atomic Transaction to create User, Staff, and StaffAssignment records
    const result = await basePrisma.$transaction(async (tx) => {
      // Create or update User record
      const user = await tx.user.upsert({
        where: { schoolId_email: { schoolId, email: normalizedEmail } },
        update: {
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          role: canonicalRole,
          passwordHash: hashedPassword,
          mustChangePassword: true,
          status: payload.status || "ACTIVE",
        },
        create: {
          schoolId,
          email: normalizedEmail,
          passwordHash: hashedPassword,
          mustChangePassword: true,
          role: canonicalRole,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          status: payload.status || "ACTIVE",
        },
      });

      // Create Staff record
      const staff = await tx.staff.create({
        data: {
          schoolId,
          userId: user.id,
          staffId: assignedStaffId,
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          middleName: payload.middleName?.trim() || null,
          email: normalizedEmail,
          phone: payload.phone.trim(),
          dateOfBirth: dob,
          gender: payload.gender,
          maritalStatus: payload.maritalStatus || null,
          residentialAddress: payload.residentialAddress.trim(),
          state: payload.state.trim(),
          lga: payload.lga.trim(),
          nin: payload.nin?.trim() || null,
          passportUrl: payload.passportUrl || null,
          dateOfEmployment: resumptionDate,
          employmentType: payload.employmentType || "FULL_TIME",
          departmentName: payload.departmentName || null,
          departmentId: payload.departmentId || null,
          reportingToId: payload.reportingToId || null,
          status: payload.status || "ACTIVE",
          highestQualification: payload.highestQualification,
          fieldOfStudy: payload.fieldOfStudy || null,
          institutionAttended: payload.institutionAttended || null,
          yearGraduated: payload.yearGraduated || null,
          trcnNumber: payload.trcnNumber?.trim() || null,
          trcnExpiry: payload.trcnExpiry ? new Date(payload.trcnExpiry) : null,
          trcnStatus: payload.trcnNumber?.trim() ? (payload.trcnExpiry && new Date(payload.trcnExpiry) < today ? "EXPIRED" : "REGISTERED") : "NOT_REGISTERED",
          professionalBody: payload.professionalBody || null,
          professionalMembershipNo: payload.professionalMembershipNo || null,
          professionalExpiry: payload.professionalExpiry ? new Date(payload.professionalExpiry) : null,
          specialization: payload.specialization || null,
          academicRank: payload.academicRank || null,
          cvUrl: payload.cvUrl || null,
          certificates: payload.certificates || null,
          nextOfKinName: payload.nextOfKinName.trim(),
          nextOfKinRelationship: payload.nextOfKinRelationship.trim(),
          nextOfKinPhone: payload.nextOfKinPhone.trim(),
          nextOfKinAddress: payload.nextOfKinAddress?.trim() || null,
          emergencyName: payload.emergencyName?.trim() || payload.nextOfKinName.trim(),
          emergencyPhone: payload.emergencyPhone?.trim() || payload.nextOfKinPhone.trim(),
          guarantorName: payload.guarantorName?.trim() || null,
          guarantorPhone: payload.guarantorPhone?.trim() || null,
          baseSalary: salaryNum,
          payGrade: payload.payGrade || null,
          bankName: payload.bankName?.trim() || null,
          bankAccountNumber: payload.bankAccountNumber?.trim() || null,
          accountName: payload.accountName?.trim() || `${payload.firstName.trim()} ${payload.lastName.trim()}`,
          pensionRsa: payload.pensionRsa || null,
          pensionProvider: payload.pensionProvider || null,
          nhisNo: payload.nhisNo || null,
          tin: payload.tin || null,
          paymentMethod: payload.paymentMethod || "BANK_TRANSFER",
          activeAt: payload.status === "ACTIVE" ? today : null,
          onboardingAt: today,
        },
      });

      // Create StaffAssignment records (Option 1 Mapping: Arm is UI label only, deduplicate base classes)
      if (payload.assignments && payload.assignments.length > 0) {
        const seenAssignmentKeys = new Set<string>();

        for (const assign of payload.assignments) {
          let resolvedClassroomId = assign.classroomId || null;

          // Verify foreign key integrity against Classroom for this tenant
          if (resolvedClassroomId) {
            const exists = await tx.classroom.findFirst({
              where: { id: resolvedClassroomId, schoolId },
              select: { id: true },
            });
            if (!exists) {
              // If not found by UUID, attempt match by metadata className (e.g. "JSS 1")
              const baseName = assign.metadata?.className;
              if (baseName) {
                const matched = await tx.classroom.findFirst({
                  where: {
                    schoolId,
                    name: { equals: baseName, mode: "insensitive" },
                  },
                  select: { id: true },
                });
                resolvedClassroomId = matched ? matched.id : null;
              } else {
                resolvedClassroomId = null;
              }
            }
          } else if (assign.metadata?.className) {
            const matched = await tx.classroom.findFirst({
              where: {
                schoolId,
                name: { equals: assign.metadata.className, mode: "insensitive" },
              },
              select: { id: true },
            });
            resolvedClassroomId = matched ? matched.id : null;
          }

          // Deduplication: prevent duplicate StaffAssignment rows for the same classroom & assignment type
          if (resolvedClassroomId) {
            const dedupeKey = `${resolvedClassroomId}_${assign.assignmentType}`;
            if (seenAssignmentKeys.has(dedupeKey)) {
              continue;
            }
            seenAssignmentKeys.add(dedupeKey);
          }

          await tx.staffAssignment.create({
            data: {
              schoolId,
              staffId: staff.id,
              classroomId: resolvedClassroomId,
              courseId: assign.courseId || null,
              assignmentType: assign.assignmentType,
              assignedRole: payload.role,
              session: "2026/2027",
              faculty: assign.faculty || null,
              department: assign.department || null,
              programme: assign.programme || null,
              metadata: assign.metadata ? JSON.stringify(assign.metadata) : null,
            },
          });
        }
      }

      return staff;
    });

    safeRevalidate(`/${subdomain}/staff`, "page");

    return {
      success: true,
      data: {
        id: result.id,
        staffId: result.staffId,
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        role: payload.role,
        status: result.status,
      },
    };
  } catch (error: any) {
    console.error("[createEnterpriseStaffAction] Fatal Error:", error);
    if (error?.code === "P2003" || (error?.message && error.message.includes("Foreign key constraint failed"))) {
      return {
        success: false,
        error: "A database foreign key constraint check failed (P2003). Please verify that the selected class exists in Settings > Classes.",
      };
    }
    return { success: false, error: error.message || "Failed to onboard staff member." };
  }
}

