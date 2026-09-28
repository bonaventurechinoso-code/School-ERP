import { NextRequest } from "next/server";
import { POST as handleInstitutionalAi } from "@/app/api/institutional-ai/route";

export async function POST(req: NextRequest) {
  return handleInstitutionalAi(req);
}
