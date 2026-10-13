import { POST as createTrialPost, GET as createTrialGet } from "@/app/api/trials/create/route";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return createTrialPost(req);
}

export async function GET(req: Request) {
  return createTrialGet(req);
}
