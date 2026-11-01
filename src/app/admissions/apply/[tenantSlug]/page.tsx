import React from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { basePrisma } from "@/lib/tenant-prisma";
import PublicApplyClient from "./PublicApplyClient";
import { NigerianTier } from "./types";

export const metadata: Metadata = {
  title: "Public Admission Application | School ERP Portal",
  description: "Official 5-step admission application portal for prospective students and candidates.",
};

export default async function PublicAdmissionsApplyPage({
  params: paramsPromise,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await paramsPromise;
  const cleanSlug = decodeURIComponent(tenantSlug || "").toLowerCase().trim();

  // Find school tenant by subdomain, slug, or ID
  let school = await basePrisma.school.findFirst({
    where: {
      OR: [
        { subdomain: cleanSlug },
        { slug: cleanSlug },
        { id: cleanSlug },
      ],
    },
    include: {
      academicTiers: true,
    },
  });

  // Sample fallback support for testing with Egede Primary School if not yet seeded
  if (!school && cleanSlug === "egede") {
    school = {
      id: "e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8",
      name: "Egede Primary School",
      subdomain: "egede",
      slug: "egede",
      academicTiers: [
        {
          id: "tier-primary-egede",
          schoolId: "e65fedc7-6524-448f-9f2a-4e4c2b7fe6b8",
          name: "NURSERY_PRIMARY",
          level: 1,
          databaseUrl: null,
          databaseName: null,
          tierDatabaseId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as any;
  }

  if (!school) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Institution Not Found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            No active school or academic portal is registered under tenant identifier:{" "}
            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 font-mono text-xs">
              {cleanSlug}
            </code>
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Return to Homepage
          </a>
        </div>
      </div>
    );
  }

  // Derive initial tier from school name or tiers
  const sName = (school.name || "").toLowerCase();
  let initialTier: NigerianTier = "NURSERY_PRIMARY";
  if (sName.includes("creche") || sName.includes("creche")) {
    initialTier = "CRECHE";
  } else if (sName.includes("secondary") || sName.includes("college") || sName.includes("high")) {
    initialTier = "SECONDARY";
  } else if (sName.includes("university") || sName.includes("polytechnic") || sName.includes("tertiary")) {
    initialTier = "TERTIARY";
  }

  const availableTiers =
    school.academicTiers && school.academicTiers.length > 0
      ? school.academicTiers.map((t) => ({ id: t.id, name: t.name }))
      : [{ id: "default-tier", name: initialTier }];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <PublicApplyClient
        schoolId={school.id}
        schoolName={school.name}
        tenantSlug={cleanSlug}
        schoolSubdomain={school.subdomain}
        availableTiers={availableTiers}
        initialTier={initialTier}
        bankAccountDetails={{
          bankName: "Zenith Bank PLC",
          accountNumber: "1012345678",
          accountName: `${school.name} Admissions`,
        }}
      />
    </div>
  );
}
