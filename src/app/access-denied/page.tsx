import React from "react";
import AccessDeniedFallback from "@/components/AccessDeniedFallback";

export default async function AccessDeniedPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ role?: string; message?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const role = searchParams.role;
  const message = searchParams.message;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <AccessDeniedFallback
        role={role}
        message={message}
      />
    </div>
  );
}
