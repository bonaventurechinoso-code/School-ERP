import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import { UserRole } from "@/lib/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userId: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: UserRole | string;
      staffRole?: string | null;
      tenantId: string;
      schoolDomain: string;
      tenantName?: string | null;
      activeTiers?: string[];
      permissions?: string[];
      sessionToken?: string;
      dbSessionId?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    userId?: string;
    role?: UserRole | string;
    staffRole?: string | null;
    tenantId?: string;
    schoolDomain?: string;
    tenantName?: string | null;
    activeTiers?: string[];
    permissions?: string[];
    sessionToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId?: string;
    role?: UserRole | string;
    staffRole?: string | null;
    tenantId?: string;
    schoolDomain?: string;
    tenantName?: string | null;
    activeTiers?: string[];
    permissions?: string[];
    sessionToken?: string;
    dbSessionId?: string;
  }
}
