import { SECURITY_CONFIG } from "./config";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect(SECURITY_CONFIG.LOGIN_ROUTE);
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  const role = (session.role || session.userRole || "").toUpperCase();
  if (role !== "SUPER_ADMIN" && !session.isSuperAdmin) {
    redirect("/access-denied");
  }
  return session;
}
