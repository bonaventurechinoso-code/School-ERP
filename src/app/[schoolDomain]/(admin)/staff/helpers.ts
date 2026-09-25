export function toCanonicalRole(roleStr?: string | null): "SUPER_ADMIN" | "SCHOOL_ADMIN" | "PRINCIPAL" | "VICE_PRINCIPAL" | "HEADMASTER" | "BURSAR" | "TEACHER" | "STUDENT" {
  const norm = (roleStr || "").toUpperCase().trim();
  if (norm.includes("HEADMASTER") || norm.includes("HEAD MISTRESS") || norm.includes("HEADMISTRESS")) return "HEADMASTER";
  if (norm.includes("VICE PRINCIPAL") || norm.includes("VICE_PRINCIPAL") || norm.includes("VP")) return "VICE_PRINCIPAL";
  if (norm.includes("PRINCIPAL")) return "PRINCIPAL";
  if (norm.includes("BURSAR") || norm.includes("ACCOUNTANT") || norm.includes("FINANCE")) return "BURSAR";
  if (norm.includes("SUPER_ADMIN") || norm.includes("SUPER ADMIN")) return "SUPER_ADMIN";
  if (norm.includes("ADMIN")) return "SCHOOL_ADMIN";
  if (norm.includes("STUDENT")) return "STUDENT";
  return "TEACHER";
}
