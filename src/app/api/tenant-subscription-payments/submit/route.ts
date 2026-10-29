import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-config";
import { prisma } from "@/lib/prisma";
import { getStorage, validateMagicBytes } from "@/lib/storage";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest | Request) {
  try {
    // 1. Session Authentication Check (Return 401 JSON, DO NOT redirect, DO NOT clear cookies)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Session expired, login again", code: "SESSION_EXPIRED" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    const userRole = String(user.role || user.userRole || "").toUpperCase();
    const isSuperAdmin = userRole === "SUPER_ADMIN" || Boolean(user.isSuperAdmin);

    // 2. Parse FormData
    const formData = await (req as NextRequest).formData();
    const file = formData.get("file") as File | null;
    const rawAmount = formData.get("amount");
    const requestedTenantId = String(formData.get("tenantId") || "").trim();
    const rawRef = String(formData.get("nipSessionId") || formData.get("reference") || "").trim();
    const rawBank = String(formData.get("senderBank") || formData.get("bankName") || "Direct Bank Transfer").trim();
    const rawAccount = String(formData.get("accountName") || formData.get("payerName") || user.name || "School Payer").trim();
    const notes = String(formData.get("notes") || formData.get("note") || "").trim() || null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Please select a payment proof receipt to upload." },
        { status: 400 }
      );
    }

    // 3. File size check
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 5MB size limit. Please upload a smaller receipt." },
        { status: 413 }
      );
    }

    const numAmount = parseFloat(String(rawAmount || "0"));
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "A valid positive transfer amount is required." },
        { status: 400 }
      );
    }

    // 4. Resolve Target Tenant
    const targetIdentifier =
      requestedTenantId ||
      user.tenantId ||
      user.schoolDomain ||
      user.schoolId ||
      "egede";

    let tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: targetIdentifier },
          { slug: { equals: targetIdentifier, mode: "insensitive" } },
          { subdomain: { equals: targetIdentifier, mode: "insensitive" } },
        ],
      },
    });

    if (!tenant) {
      // Fallback search
      tenant = await prisma.tenant.findFirst({
        where: { status: { not: "DELETED" } },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!tenant) {
      return NextResponse.json(
        { error: "Target institution/tenant not found." },
        { status: 404 }
      );
    }

    // 5. Tenant Permission Check
    if (!isSuperAdmin) {
      const userTenant = (user.tenantId || "").trim();
      const userDomain = (user.schoolDomain || "").trim().toLowerCase();
      const tenantSlug = (tenant.slug || "").toLowerCase();
      const tenantSub = (tenant.subdomain || "").toLowerCase();

      if (
        userTenant &&
        userTenant !== tenant.id &&
        userDomain !== tenantSlug &&
        userDomain !== tenantSub
      ) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission for this tenant workspace." },
          { status: 403 }
        );
      }
    }

    // 6. Validate magic bytes and convert buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: "Corrupted or invalid file contents. File does not match declared format." },
        { status: 400 }
      );
    }

    // 7. Upload file to persistent storage (Base64 in DB + Cloudinary if configured)
    const cleanFileName = `proof_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}.${file.name.split(".").pop() || "jpg"}`;
    const storageResult = await getStorage().upload(buffer, cleanFileName, file.type);

    // 8. Generate unique session reference if none provided
    const nipSessionId =
      rawRef ||
      `NIP_${Date.now()}_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // 9. Persist into TenantSubscriptionPayment
    const newPayment = await prisma.tenantSubscriptionPayment.create({
      data: {
        tenantId: tenant.id,
        schoolSlug: tenant.slug || tenant.subdomain || "portal",
        schoolName: tenant.schoolName || (tenant as any).name || "Institution",
        amount: numAmount,
        nipSessionId,
        senderBank: rawBank,
        accountName: rawAccount,
        receiptUrl: storageResult.url,
        receiptData: storageResult.data || null,
        receiptMimeType: storageResult.mimeType,
        receiptSize: storageResult.size,
        receiptPublicId: storageResult.publicId || null,
        receiptChecksum: storageResult.checksum,
        status: "PENDING",
        notes,
      },
    });

    // 10. Also maintain legacy SubscriptionPayment table for backward compatibility
    try {
      await prisma.subscriptionPayment.create({
        data: {
          id: newPayment.id,
          tenantId: tenant.id,
          amount: numAmount,
          receiptUrl: storageResult.url,
          status: "PENDING_VERIFICATION",
        },
      });
    } catch (legacyErr) {
      console.warn("[TENANT_PAYMENT_SUBMIT] Legacy subscriptionPayment sync notice:", legacyErr);
    }

    return NextResponse.json({
      success: true,
      id: newPayment.id,
      paymentId: newPayment.id,
      status: "PENDING",
      message: "Receipt submitted successfully! Super Admin will review and verify.",
    });
  } catch (error: any) {
    console.error("[TENANT_SUBSCRIPTION_PAYMENT_SUBMIT_ERROR]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process payment receipt." },
      { status: 500 }
    );
  }
}
