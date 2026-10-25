import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let uploadthingTest: any = null;
  let uploadthingError: any = null;
  let fileCount = 0;
  try {
    const ut = await import("@/lib/uploadthing");
    uploadthingTest = await ut.findFileInUploadthing("passport-1792856735162.jpg");
    uploadthingError = ut.lastUploadthingError;
    fileCount = ut.lastUploadthingFileCount;
  } catch (err: any) {
    uploadthingError = {
      message: err?.message,
      name: err?.name,
      cause: err?.cause ? String(err.cause) : undefined,
    };
  }

  const rawToken = process.env.UPLOADTHING_TOKEN || "";
  const tokenPrefix = rawToken ? rawToken.slice(0, 12) + "..." : "none";

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "SchoolERP Multi-Tenant Platform",
    hasUploadthingToken: Boolean(rawToken),
    tokenPrefix,
    fileCount,
    uploadthingTest,
    uploadthingError,
    version: "e68c83b-diag-v2",
  });
}
