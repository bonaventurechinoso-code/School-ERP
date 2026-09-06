import { NextRequest, NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenant-prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentLeadId, content, authorName, schoolId } = body;

    if (!studentLeadId || !content || !authorName || !schoolId) {
      return NextResponse.json(
        { error: "studentLeadId, content, authorName, and schoolId are required" },
        { status: 400 }
      );
    }

    const prisma = getTenantClient(schoolId);

    // Verify lead exists
    const lead = await prisma.admissionLead.findUnique({
      where: { id: studentLeadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Create the relational note
    const note = await prisma.admissionNote.create({
      data: {
        studentLeadId,
        content,
        authorName,
      },
    });

    return NextResponse.json({ success: true, data: note });
  } catch (error: any) {
    console.error("Error creating admission note:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
