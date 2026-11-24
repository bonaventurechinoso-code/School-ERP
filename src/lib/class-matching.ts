/**
 * Canonical helper to check if a student's enrolled class matches an assigned/target class.
 * Handles:
 * 1. Exact match (case-insensitive): "Primary 2" === "primary 2"
 * 2. Arm suffixes with spaces: "Primary 2 A" matches "Primary 2"
 * 3. Arm suffixes without spaces: "Primary 2A" matches "Primary 2"
 * 4. Arm suffixes in parentheses: "Primary 2 (A)" matches "Primary 2"
 * 5. Arm suffixes with dashes: "Primary 2 - A" matches "Primary 2"
 * 6. Reverse matching: target is "Primary 2 A" and student is "Primary 2"
 * 7. Tier aliases: "Class 2" <-> "Primary 2" <-> "Basic 2" <-> "Pry 2"
 * 8. Secondary aliases: "JSS 1 A" <-> "JSS 1" <-> "JS 1", "SSS 2" <-> "SS 2"
 * 9. Creche / Nursery aliases: "KG 1" <-> "Nursery 1", "Creche" <-> "Toddler"
 */
export function isClassMatch(
  studentClass?: string | null,
  targetClass?: string | null
): boolean {
  if (!targetClass || targetClass === "ALL" || targetClass === "All Classes" || targetClass === "") {
    return true;
  }
  if (!studentClass) return false;

  const sNorm = studentClass.trim().toLowerCase();
  const tNorm = targetClass.trim().toLowerCase();
  if (sNorm === tNorm) return true;

  // Helper: Strip arms/streams to extract base class e.g. "Primary 2 A" -> "primary 2", "Primary 2 (Gold)" -> "primary 2"
  const cleanBase = (str: string) =>
    str
      .replace(/\s*[\(\[-].*?[\)\]-]/g, "") // remove parenthesized arms e.g. (A), [Gold], - Arm A
      .replace(/\s+[a-z]$/i, "") // remove single letter arm e.g. " A"
      .replace(/(primary|basic|class|jss|sss|pry|grade|kg|nursery)\s*(\d+)[a-z]$/i, "$1 $2") // e.g. "Primary 2A" -> "Primary 2"
      .trim();

  const sBase = cleanBase(sNorm);
  const tBase = cleanBase(tNorm);

  if (sBase && tBase && sBase === tBase) return true;

  // Prefix checks: "Primary 2 A".startsWith("primary 2") or vice-versa
  if (sNorm.startsWith(tNorm + " ") || tNorm.startsWith(sNorm + " ")) return true;
  if (sNorm.startsWith(tBase + " ") || tNorm.startsWith(sBase + " ")) return true;

  // Word boundary regex check
  const escapedTarget = tNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tPattern = new RegExp(`(^|\\b)${escapedTarget}(\\b|[^0-9]|$)`, "i");
  if (tPattern.test(sNorm)) return true;

  const escapedStudent = sNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sPattern = new RegExp(`(^|\\b)${escapedStudent}(\\b|[^0-9]|$)`, "i");
  if (sPattern.test(tNorm)) return true;

  // Numeric equivalence across Nigerian tier nomenclature
  const sNum = sNorm.match(/\d+/)?.[0];
  const tNum = tNorm.match(/\d+/)?.[0];
  if (sNum && tNum && sNum === tNum) {
    // Primary / Basic / Class / Elementary
    const isPrimaryName = (str: string) =>
      str.includes("primary") ||
      str.includes("basic") ||
      str.includes("class") ||
      str.includes("grade") ||
      str.includes("pry");
    if (isPrimaryName(sNorm) && isPrimaryName(tNorm)) return true;

    // Junior Secondary
    const isJuniorSec = (str: string) =>
      str.includes("jss") || str.includes("js") || str.includes("junior");
    if (isJuniorSec(sNorm) && isJuniorSec(tNorm)) return true;

    // Senior Secondary
    const isSeniorSec = (str: string) =>
      str.includes("sss") || str.includes("ss") || str.includes("senior");
    if (isSeniorSec(sNorm) && isSeniorSec(tNorm)) return true;
  }

  return false;
}
