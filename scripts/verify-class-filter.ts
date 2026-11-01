import { getClassOptionsForTier, matchesClass } from "../src/app/[schoolDomain]/(admin)/students/StudentTable";

function runTests() {
  console.log("=== RUNNING CLASS FILTER TESTS ===");

  // 1. Creche / Nursery
  const crecheOptions1 = getClassOptionsForTier("Creche/Nursery");
  console.log("Creche/Nursery:", crecheOptions1);
  if (JSON.stringify(crecheOptions1) !== JSON.stringify(["Creche", "Pre-Nursery", "Nursery 1", "Nursery 2"])) {
    throw new Error("Creche/Nursery options mismatch");
  }

  const crecheOptions2 = getClassOptionsForTier("Creche");
  console.log("Creche:", crecheOptions2);
  if (JSON.stringify(crecheOptions2) !== JSON.stringify(["Creche", "Pre-Nursery", "Nursery 1", "Nursery 2"])) {
    throw new Error("Creche options mismatch");
  }

  // 2. Primary School
  const primaryOptions = getClassOptionsForTier("Primary School");
  console.log("Primary School:", primaryOptions);
  if (JSON.stringify(primaryOptions) !== JSON.stringify(["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"])) {
    throw new Error("Primary options mismatch");
  }

  // 3. Secondary School
  const secondaryOptions = getClassOptionsForTier("Secondary School");
  console.log("Secondary School:", secondaryOptions);
  if (JSON.stringify(secondaryOptions) !== JSON.stringify(["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"])) {
    throw new Error("Secondary options mismatch");
  }

  // 4. matchesClass tests
  console.log("Testing matchesClass:");
  if (!matchesClass("Class 1", "Class 1")) throw new Error("matchesClass failed exact match");
  if (!matchesClass("Class 1 Gold", "Class 1")) throw new Error("matchesClass failed prefix match");
  if (!matchesClass("Primary 1", "Class 1")) throw new Error("matchesClass failed alias match");
  if (matchesClass("Class 10", "Class 1")) throw new Error("matchesClass incorrectly matched Class 10 to Class 1");
  if (matchesClass("Class 2", "Class 1")) throw new Error("matchesClass incorrectly matched Class 2 to Class 1");
  if (!matchesClass("JSS 1 A", "JSS 1")) throw new Error("matchesClass failed JSS 1 prefix match");
  if (matchesClass("SSS 1", "JSS 1")) throw new Error("matchesClass incorrectly matched SSS 1 to JSS 1");

  console.log("ALL TESTS PASSED SUCCESSFULLY! ✅");
}

runTests();
