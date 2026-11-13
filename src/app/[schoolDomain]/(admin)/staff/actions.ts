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
  const schoolId = await resolveSchoolId(schoolIdentifier);

  // Strict session and RBAC authorization verification
  const session = await getSession(undefined, schoolId);
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

  await ensureStaffMetadataTable();

  const cacheKey = buildCacheKey({
    tenantId: schoolId,
    table: "staff",
    action: "paginated_enhanced",
    cursor,
    limit,
    filters: { role, status, departmentId, search },
  });

  return cacheAside<CursorPaginationResult<any>>({
    key: cacheKey,
    ttlSeconds: 900, // 15 minutes safe sliding TTL
    fetchFn: async () => {
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
    },
  });
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
    appointmentDate?: string;
    emergencyName?: string;
    emergencyPhone?: string;
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
    const classrooms = await tenantDb.classroom.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        tierId: true,
        tier: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return { success: true, data: classrooms };
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

