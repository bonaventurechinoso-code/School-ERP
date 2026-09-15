import NextAuth from "next-auth";
import { authOptions } from "@/lib/nextauth-config";

/**
 * NextAuth.js App Router API Route Handler
 * Serves authentication endpoints for both Credentials and Google OAuth:
 * - GET  /api/auth/signin
 * - GET  /api/auth/signout
 * - GET  /api/auth/session
 * - GET  /api/auth/providers
 * - POST /api/auth/signin/:provider
 * - GET/POST /api/auth/callback/:provider
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
