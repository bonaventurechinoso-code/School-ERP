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
    <div className="min-h-screen w-full bg-slate-50 dark:bg-zinc-950 flex flex-col justify-start py-6 sm:py-10 px-4 sm:px-6 overflow-y-auto">
      <div className="my-auto w-full">
        <AccessDeniedFallback
          role={role}
          message={message}
        />
      </div>
    </div>
  );
}
