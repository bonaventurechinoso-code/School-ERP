import { NextRequest, NextResponse } from "next/server";
import { getTenantClient } from "@/lib/tenant-prisma";
import * as jose from "jose";

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get("session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);

    const role = payload.role as string;
    const tenantId = payload.tenantId as string;

    if (role !== "ADMIN" && role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const lowerPrompt = prompt.toLowerCase();
    
    // Intelligent Intent Parser
    if (lowerPrompt.includes("number of students") || lowerPrompt.includes("total student count") || lowerPrompt.includes("how many students")) {
      const prisma = getTenantClient(tenantId);
      const totalStudents = await prisma.student.count({
        where: { schoolId: tenantId }
      });
      
      return NextResponse.json({
        response: `Your institution currently has a total of **${totalStudents}** registered students across all active grade levels.`
      });
    }

    return NextResponse.json({
      response: "I'm sorry, I don't currently have the schema capabilities to answer that specific query. Try asking me about the total student count!"
    });

  } catch (error: any) {
    console.error("AI Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
