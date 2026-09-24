import { NextResponse } from "next/server";
import { checkSSLHealth } from "@/lib/ssl-provisioning";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const subdomain = url.searchParams.get("subdomain") || url.searchParams.get("domain")?.split(".")[0] || "";

    if (!subdomain) {
      return NextResponse.json(
        { error: "Subdomain parameter is required." },
        { status: 400 }
      );
    }

    const cleanSubdomain = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const healthResult = await checkSSLHealth(cleanSubdomain);

    return NextResponse.json(healthResult, { status: 200 });
  } catch (error: any) {
    console.error("[SSL_VERIFY_ENDPOINT_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal error checking SSL health", details: error?.message },
      { status: 500 }
    );
  }
}
