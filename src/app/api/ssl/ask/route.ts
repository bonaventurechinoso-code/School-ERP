import { NextResponse } from "next/server";
import { verifyTenantDomainForSSL, triggerSSLProvisioning } from "@/lib/ssl-provisioning";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const domain = url.searchParams.get("domain") || url.searchParams.get("host") || "";

    if (!domain) {
      return NextResponse.json(
        { error: "Domain parameter is required." },
        { status: 400 }
      );
    }

    const result = await verifyTenantDomainForSSL(domain);

    if (result.allowed) {
      return NextResponse.json(
        {
          status: "allowed",
          domain: result.domain,
          reason: result.reason,
          subdomain: result.subdomain,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        status: "denied",
        domain: result.domain,
        reason: result.reason,
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[SSL_ASK_ROUTE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal error during SSL domain check", details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const subdomain = body.subdomain || body.domain;

    if (!subdomain) {
      return NextResponse.json(
        { error: "Subdomain or domain parameter is required." },
        { status: 400 }
      );
    }

    const cleanSubdomain = subdomain.trim().toLowerCase().split(".")[0];
    const provResult = await triggerSSLProvisioning(cleanSubdomain);

    return NextResponse.json(provResult, { status: 200 });
  } catch (error: any) {
    console.error("[SSL_PROV_TRIGGER_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal error triggering SSL provisioning", details: error?.message },
      { status: 500 }
    );
  }
}
