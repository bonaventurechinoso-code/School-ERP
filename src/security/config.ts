export const SECURITY_CONFIG = {
  SUPER_ADMIN_EMAIL: "bonaveeict@mail.com",
  PROTECTED_ROUTES: ["/super-admin", "/dashboard", "/admin"],
  LOGIN_ROUTE: "/login",
  SESSION_COOKIES: ["auth_token", "session", "next-auth.session-token"],
} as const;
