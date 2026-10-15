export const SECURITY_CONFIG = {
  SUPER_ADMIN_EMAIL: "bonaveeict@mail.com",
  PROTECTED_ROUTES: [
    "/super-admin",
    "/dashboard",
    "/admin",
    "/teacher",
    "/bursar",
    "/school-admin",
    "/tenant-admin",
    "/portal",
    "/change-password",
  ],
  LOGIN_ROUTE: "/login",
  SESSION_COOKIES: ["session", "accessToken", "auth_token", "next-auth.session-token"],
} as const;
