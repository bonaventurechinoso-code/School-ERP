import { cookies } from "next/headers";
import * as jose from "jose";

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: string;
  schoolDomain: string;
  [key: string]: any;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get("session")?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET_KEY || "fallback-secret-for-development-do-not-use-in-prod";
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(sessionToken, secret);
    return payload as unknown as SessionPayload;
  } catch (error) {
    console.error("Failed to decode session token:", error);
    return null;
  }
}
