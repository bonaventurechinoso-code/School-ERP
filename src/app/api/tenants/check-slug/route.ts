import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/tenant-prisma";
import {
  isReservedSubdomain,
  generateSlugFromName,
  buildTenantUrl,
  parseHostInfo,
} from "@/lib/tenant-resolver";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawSlug = searchParams.get("slug") || "";
    const rawName = searchParams.get("name") || "";

    const candidateSlug = (
      rawSlug ? rawSlug.trim() : generateSlugFromName(rawName)
    )
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const protoHeader = request.headers.get("x-forwarded-proto");
    const hostInfo = parseHostInfo(hostHeader, protoHeader);

    if (!candidateSlug) {
      return NextResponse.json(
        {
          available: false,
          slug: "",
          error: "A valid alphanumeric slug is required.",
          code: "SLUG_EMPTY",
        },
        { status: 400 }
      );
    }

    // 1. Reserved Subdomain Check
    if (isReservedSubdomain(candidateSlug)) {
      const suggested = `${candidateSlug}-school`;
      return NextResponse.json({
        available: false,
        slug: candidateSlug,
        error: `The subdomain "${candidateSlug}" is reserved by the platform.`,
        code: "SLUG_RESERVED",
        suggested,
        url: buildTenantUrl(suggested, hostHeader, "", protoHeader),
      });
    }

    // 2. Database Uniqueness Check against School & Tenant tables
    const [existingSchool, existingTenant] = await Promise.all([
      basePrisma.school.findFirst({
        where: {
          OR: [
            { subdomain: { equals: candidateSlug, mode: "insensitive" } },
            { slug: { equals: candidateSlug, mode: "insensitive" } },
          ],
          deletedAt: null,
        },
        select: { id: true, subdomain: true, slug: true },
      }),
      basePrisma.tenant.findFirst({
        where: {
          OR: [
            { subdomain: { equals: candidateSlug, mode: "insensitive" } },
            { slug: { equals: candidateSlug, mode: "insensitive" } },
          ],
        },
        select: { id: true, subdomain: true, slug: true },
      }),
    ]);

    const isTaken = Boolean(existingSchool || existingTenant);

    if (!isTaken) {
      return NextResponse.json({
        available: true,
        slug: candidateSlug,
        url: buildTenantUrl(candidateSlug, hostHeader, "", protoHeader),
      });
    }

    // 3. Generate sequential alternative suggestion: candidateSlug-2, candidateSlug-3...
    let counter = 2;
    let alternativeSlug = `${candidateSlug}-${counter}`;

    while (counter < 20) {
      const [altSchool, altTenant] = await Promise.all([
        basePrisma.school.findFirst({
          where: {
            OR: [
              { subdomain: { equals: alternativeSlug, mode: "insensitive" } },
              { slug: { equals: alternativeSlug, mode: "insensitive" } },
            ],
            deletedAt: null,
          },
          select: { id: true },
        }),
        basePrisma.tenant.findFirst({
          where: {
            OR: [
              { subdomain: { equals: alternativeSlug, mode: "insensitive" } },
              { slug: { equals: alternativeSlug, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        }),
      ]);

      if (!altSchool && !altTenant) {
        break;
      }

      counter++;
      alternativeSlug = `${candidateSlug}-${counter}`;
    }

    return NextResponse.json({
      available: false,
      slug: candidateSlug,
      error: `The URL slug "${candidateSlug}" is already taken.`,
      code: "SLUG_TAKEN",
      suggested: alternativeSlug,
      url: buildTenantUrl(alternativeSlug, hostHeader, "", protoHeader),
    });
  } catch (err: any) {
    console.error("[CHECK_SLUG_EXCEPTION]:", err);
    return NextResponse.json(
      { available: false, error: "Failed to evaluate slug availability." },
      { status: 500 }
    );
  }
}
