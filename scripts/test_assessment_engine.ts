import {
  calculateBonaVeeResult,
  compileAnnualTerms,
  getNigerianGrade,
  getTertiaryGP,
  ACTIVE_INSTITUTIONAL_TIERS,
  TIER_DEFAULT_WEIGHTS,
} from "../src/lib/assessmentEngine";

console.log("=== UNIT TEST: ASSESSMENT ENGINE ===");

// 1. Daycare / Nursery
const daycareRes = calculateBonaVeeResult("Daycare / Nursery", {
  observation: 100,
  classwork: 80,
  affective: 90,
});
console.log("Daycare / Nursery Result:", daycareRes);
if (daycareRes.total !== 90) throw new Error(`Daycare total expected 90, got ${daycareRes.total}`);

// 2. Primary School
const primaryRes = calculateBonaVeeResult("Primary School", {
  assignment: 10,
  test: 20,
  project: 10,
  exam: 50,
});
console.log("Primary School Result:", primaryRes);
if (primaryRes.total !== 90 || primaryRes.grade !== "A1") {
  throw new Error(`Primary result mismatch: total=${primaryRes.total}, grade=${primaryRes.grade}`);
}

// 3. Secondary School
const secondaryRes = calculateBonaVeeResult("Secondary School", {
  ca1: 18,
  ca2: 17,
  exam: 55,
});
console.log("Secondary School Result:", secondaryRes);
if (secondaryRes.total !== 90 || secondaryRes.grade !== "A1") {
  throw new Error(`Secondary result mismatch: total=${secondaryRes.total}, grade=${secondaryRes.grade}`);
}

// 4. Higher Education
const uniRes = calculateBonaVeeResult("University", {
  assignment: 8,
  test: 18,
  exam: 64,
});
console.log("University Result:", uniRes);
if (uniRes.total !== 90 || uniRes.grade !== "A" || uniRes.gp !== 5.0) {
  throw new Error(`University result mismatch: total=${uniRes.total}, grade=${uniRes.grade}, gp=${uniRes.gp}`);
}

// 5. Promotion Logic
const promo1 = compileAnnualTerms(60, 70, 80, 80);
console.log("Promotion 1:", promo1);
if (promo1.promotion !== "Promoted") throw new Error("Expected Promoted");

const promo2 = compileAnnualTerms(40, 40, 40, 80);
console.log("Promotion 2 (Low score):", promo2);
if (promo2.promotion !== "Repeat") throw new Error("Expected Repeat");

const promo3 = compileAnnualTerms(70, 70, 70, 60);
console.log("Promotion 3 (Low attendance):", promo3);
if (promo3.promotion !== "Repeat") throw new Error("Expected Repeat");

// 6. Active Tiers count
console.log("Active Setup Tiers:", ACTIVE_INSTITUTIONAL_TIERS);
if (ACTIVE_INSTITUTIONAL_TIERS.length !== 6) throw new Error("Expected 6 setup tiers");

// 7. Check default weights sum to 100%
for (const tier of ACTIVE_INSTITUTIONAL_TIERS) {
  const components = TIER_DEFAULT_WEIGHTS[tier];
  const sum = components.reduce((acc, c) => acc + c.weight, 0);
  console.log(`Tier [${tier}] Cumulative Weight: ${sum}%`);
  if (sum !== 100) throw new Error(`Tier ${tier} sum is ${sum}, expected 100`);
}

console.log(">>> ALL ASSESSMENT ENGINE TESTS PASSED! <<<");
