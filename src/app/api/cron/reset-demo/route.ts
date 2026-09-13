import { NextResponse } from "next/server";
import { executeDemoCleanup, startDemoCleanupCron } from "@/lib/cron-demo-cleanup";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger." }, { status: 401 });
    }

    const result = await executeDemoCleanup();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[CRON_RESET_DEMO_API_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to reset demo database", details: error?.message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    // Start recurring scheduler if not already active
    startDemoCleanupCron();

    const result = await executeDemoCleanup();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[CRON_RESET_DEMO_API_ERROR]:", error);
    return NextResponse.json(
      { error: "Failed to reset demo database", details: error?.message },
      { status: 500 }
    );
  }
}
