import { NextRequest, NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenant-prisma";

export async function PATCH(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await paramsPromise;
  try {
    const { id } = resolvedParams;
    const body = await req.json();
    const { status, schoolId } = body;

    if (!status || !schoolId) {
      return NextResponse.json(
        { error: "status and schoolId are required" },
        { status: 400 }
      );
    }

    const prisma = getTenantClient(schoolId);

    const updatedLead = await prisma.admissionLead.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });

    return NextResponse.json({ success: true, data: updatedLead });
  } catch (error: any) {
    console.error("Error updating admission lead status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
