import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";

export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("auth_token")?.value ||
    cookieStore.get("session")?.value;

  if (!token) {
    redirect("/login");
  }

  let user: { role?: string; email?: string } | null = null;
  try {
    const jwtSecret =
      process.env.JWT_SECRET_KEY ||
      "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    user = {
      role: (
        (payload.role as string) ||
        (payload.userRole as string) ||
        ""
      ).toLowerCase(),
      email: ((payload.email as string) || "").toLowerCase().trim(),
    };
  } catch {
    redirect("/login");
  }

  if (user?.role !== "super_admin" && user?.email !== "bonaveeict@mail.com") {
    redirect("/login");
  }

  return <>{children}</>;
}
