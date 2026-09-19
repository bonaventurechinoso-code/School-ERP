import { NextRequest, NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: subdomain } = await params;
    const cleanSubdomain = subdomain.trim().toLowerCase();

    const school = await basePrisma.school.findFirst({
      where: {
        OR: [{ subdomain: cleanSubdomain }, { id: subdomain }],
      },
      select: {
        id: true,
        name: true,
        subdomain: true,
        settlementBankName: true,
        settlementBankCode: true,
        settlementAccountNumber: true,
        settlementAccountName: true,
        paymentInstruction: true,
        collectionMode: true,
      },
    });

    if (!school) {
      return NextResponse.json(
        { error: "School not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      school: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        bankName: school.settlementBankName,
        accountNumber: school.settlementAccountNumber,
        accountName: school.settlementAccountName,
        instruction: school.paymentInstruction || "Use Student Admission No as transfer narration",
        isConfigured: Boolean(school.settlementAccountNumber && school.settlementBankName),
      },
    });
  } catch (error: any) {
    console.error("[GET_TENANT_BANK_DETAILS_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to load collection account details", details: error?.message },
      { status: 500 }
    );
  }
}
