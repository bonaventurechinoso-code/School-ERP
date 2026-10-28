import { NextRequest, NextResponse } from "next/server";
import { createPaymentReceipt } from "@/lib/payment-receipt-service";
import { uploadToUploadthing } from "@/lib/uploadthing";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const moduleType = (formData.get("moduleType") as any) || "ADMISSION_FORM_FEE";
    const payerType = (formData.get("payerType") as any) || "APPLICANT";
    const payerId = (formData.get("payerId") as string) || undefined;
    const payerName = (formData.get("payerName") as string) || "Anonymous Payer";
    const payerEmail = (formData.get("payerEmail") as string) || undefined;
    const referenceNo = (formData.get("referenceNo") as string) || "";
    const amount = parseFloat((formData.get("amount") as string) || "0") || 0;
    const paymentDate = (formData.get("paymentDate") as string) || new Date().toISOString();
    const paymentMethod = (formData.get("paymentMethod") as any) || "BANK_TRANSFER";
    const paymentMode =
      ((formData.get("paymentMode") as string) as any) ||
      (paymentMethod === "ONLINE" ? "DIRECT_GATEWAY" : "MANUAL_TRANSFER");
    const depositorName =
      (formData.get("depositorName") as string) ||
      (formData.get("depositor_name") as string) ||
      payerName;
    const txnRef =
      (formData.get("transferReference") as string) ||
      (formData.get("transfer_reference") as string) ||
      (formData.get("txnRef") as string) ||
      undefined;
    const bankName = (formData.get("bankName") as string) || undefined;
    const tenantId = (formData.get("tenantId") as string) || "default";
    const schoolId = (formData.get("schoolId") as string) || undefined;
    const linkedInvoiceId = (formData.get("linkedInvoiceId") as string) || undefined;
    const term = (formData.get("term") as string) || undefined;
    const session = (formData.get("session") as string) || undefined;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "client";

    const file = formData.get("file") as File | null;
    let fileUrl =
      (formData.get("proofOfPaymentUrl") as string) ||
      (formData.get("proof_of_payment_url") as string) ||
      (formData.get("fileUrl") as string) ||
      "";
    let fileKey: string | undefined = undefined;
    let fileName: string | undefined = undefined;

    if (!referenceNo) {
      return NextResponse.json(
        { success: false, error: "referenceNo is required" },
        { status: 400 }
      );
    }

    if (file && file.size > 0) {
      fileName = file.name;
      // 1. Upload to persistent cloud storage (Uploadthing)
      try {
        const sanitizedCleanName = `receipt-${referenceNo.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}${path.extname(file.name)}`;
        const cloudUpload = await uploadToUploadthing(file, sanitizedCleanName);
        if (cloudUpload && cloudUpload.url) {
          fileUrl = cloudUpload.url;
          fileKey = cloudUpload.key;
          fileName = cloudUpload.name;
        }
      } catch (cloudErr) {
        console.warn("[RECEIPT_CLOUD_UPLOAD_WARN]:", cloudErr);
      }

      // 2. Local fallback if cloud upload did not provide a URL
      if (!fileUrl) {
        try {
          const uploadsDir = path.resolve(process.cwd(), "public", "uploads", "receipts", tenantId);
          fs.mkdirSync(uploadsDir, { recursive: true });
          const diskFileName = `receipt-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const diskFilePath = path.join(uploadsDir, diskFileName);
          const buffer = Buffer.from(await file.arrayBuffer());
          fs.writeFileSync(diskFilePath, buffer);
          fileUrl = `/api/uploads/receipts/${tenantId}/${diskFileName}`;
          fileName = diskFileName;
        } catch (diskErr) {
          console.error("[RECEIPT_DISK_SAVE_ERROR]:", diskErr);
        }
      }
    }

    if (!fileUrl) {
      return NextResponse.json(
        { success: false, error: "A valid receipt image or PDF file is required" },
        { status: 400 }
      );
    }

    const receipt = await createPaymentReceipt({
      tenantId,
      schoolId,
      moduleType,
      payerType,
      payerId,
      payerName,
      payerEmail,
      referenceNo,
      amount,
      paymentDate,
      paymentMethod,
      paymentMode,
      depositorName,
      transferReference: txnRef,
      txnRef,
      bankName,
      fileUrl,
      proofOfPaymentUrl: fileUrl,
      fileKey,
      fileName: fileName || file?.name || "receipt.pdf",
      linkedInvoiceId,
      term,
      session,
      ip,
    });

    return NextResponse.json({
      success: true,
      message: "Payment receipt uploaded successfully and submitted for bursar verification.",
      receipt,
    });
  } catch (error: any) {
    console.error("[PAYMENT_RECEIPT_UPLOAD_ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload payment receipt" },
      { status: 500 }
    );
  }
}
