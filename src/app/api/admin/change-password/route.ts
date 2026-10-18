import { GET as profileGET, POST as profilePOST } from "../profile/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return profileGET(req);
}

export async function POST(req: Request) {
  return profilePOST(req);
}
