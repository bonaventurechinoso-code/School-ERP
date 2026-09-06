import { NextRequest, NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenant-prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { logEntry, schoolId } = body;

    if (!logEntry || !schoolId) {
      return NextResponse.json(
        { error: "logEntry and schoolId are required" },
        { status: 400 }
      );
    }

    const prisma = getTenantClient(schoolId);

    // Fetch current logs
    const lead = await prisma.admissionLead.findUnique({
      where: { id },
      select: { logs: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const currentLogs = Array.isArray(lead.logs) ? lead.logs : [];
    const newLog = {
      text: logEntry,
      timestamp: new Date().toISOString(),
    };
    
    currentLogs.push(newLog);

    const updatedLead = await prisma.admissionLead.update({
      where: { id },
      data: {
        logs: currentLogs,
      },
    });

    return NextResponse.json({ success: true, data: updatedLead });
  } catch (error: any) {
    console.error("Error adding log:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
