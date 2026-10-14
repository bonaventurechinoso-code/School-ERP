import { SECURITY_CONFIG } from "./config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const cookieStore = await cookies();
  const hasSession = SECURITY_CONFIG.SESSION_COOKIES.some((name) => cookieStore.get(name));
  if (!hasSession) {
    redirect(SECURITY_CONFIG.LOGIN_ROUTE);
  }
}

export async function requireSuperAdmin() {
  await requireAuth();
}
