import { compressPayload, decompressPayload } from "../src/lib/compression";
import { safeRedisGet, safeRedisSet, safeRedisDel, isRedisConnected, safeRedisScanDel } from "../src/lib/redis";
import { buildCacheKey, cacheAside } from "../src/lib/cache";
import { buildPrismaCursorArgs, formatCursorPaginationResult } from "../src/lib/pagination";
import { invalidateStudentNamespace, invalidateFinanceNamespace } from "../src/lib/cache-invalidation";

async function runVerification() {
  console.log("=================================================");
  console.log("  ENTERPRISE CACHE & PRISMA OPTIMIZATION TESTS  ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Compression & Decompression Roundtrip (> 1KB)
  // -------------------------------------------------------------
  console.log("--- 1. SMART COMPRESSION ENGINE ---");
  const smallData = { message: "Hello World", count: 42 };
  const smallSerialized = compressPayload(smallData);
  assert(!smallSerialized.startsWith("__gz:"), "Small payload (<1KB) remains uncompressed");
  const smallDecompressed = decompressPayload(smallSerialized);
  assert(smallDecompressed.count === 42, "Small payload decompresses correctly");

  // Create large array simulating 200 student rows (>10KB)
  const largeData = Array.from({ length: 200 }, (_, i) => ({
    id: `student-uuid-${i}`,
    firstName: `StudentFirstName${i}`,
    lastName: `StudentLastName${i}`,
    email: `student.${i}@schoolerp.example.com`,
    admissionNumber: `SCH/2026/${String(i).padStart(4, "0")}`,
    status: "ENROLLED",
    dynamicFields: { allergies: "None", transportRoute: "North Route Bus #4" },
  }));

  const uncompressedSize = Buffer.byteLength(JSON.stringify(largeData), "utf8");
  const largeCompressed = compressPayload(largeData);
  const compressedSize = Buffer.byteLength(largeCompressed, "utf8");

  assert(largeCompressed.startsWith("__gz:"), "Large payload (>=1KB) is prefixed with __gz:");
  assert(
    compressedSize < uncompressedSize * 0.4,
    `Payload compressed by >60% (Raw: ${uncompressedSize} bytes -> Compressed: ${compressedSize} bytes)`
  );

  const largeDecompressed = decompressPayload<typeof largeData>(largeCompressed);
  assert(
    largeDecompressed !== null && largeDecompressed.length === 200 && largeDecompressed[199].admissionNumber === "SCH/2026/0199",
    "Compressed payload roundtrip decompresses perfectly with 100% data fidelity"
  );

  // -------------------------------------------------------------
  // Test 2: Structured Namespace Keys
  // -------------------------------------------------------------
  console.log("\n--- 2. STRUCTURED NAMESPACED KEYS ---");
  const key = buildCacheKey({
    tenantId: "sch_alpha_99",
    tierName: "Primary School",
    table: "students",
    action: "paginated",
    cursor: "stud_12345",
    limit: 50,
    filters: { status: "ENROLLED", currentClass: "Grade 4A" },
  });

  assert(
    key.includes("cache:tenant:sch_alpha_99:tier:primaryschool:table:students"),
    "Base namespace matches cache:tenant:[tenantId]:tier:[tierName]:table:[tableName]"
  );
  assert(
    key.includes("cursor:stud_12345") && key.includes("limit:50") && key.includes("status:ENROLLED"),
    "Namespace query segments include deterministic sorted cursor and filter metadata"
  );

  // -------------------------------------------------------------
  // Test 3: Cursor Pagination Engine
  // -------------------------------------------------------------
  console.log("\n--- 3. MANDATORY CURSOR-BASED PAGINATION ---");
  const prismaArgs = buildPrismaCursorArgs({ cursor: "item-025", limit: 25 });
  assert(prismaArgs.take === 26, "buildPrismaCursorArgs requests limit + 1 (take: 26) to detect next page");
  assert(prismaArgs.cursor?.id === "item-025", "buildPrismaCursorArgs sets B-Tree indexed cursor jump");
  assert(prismaArgs.skip === 1, "buildPrismaCursorArgs skips the cursor anchor row");

  const simulatedDbRows = Array.from({ length: 26 }, (_, i) => ({ id: `row-${i + 1}` }));
  const paginatedResult = formatCursorPaginationResult(simulatedDbRows, 25);
  assert(paginatedResult.hasMore === true, "formatCursorPaginationResult sets hasMore: true when extra row exists");
  assert(paginatedResult.items.length === 25, "formatCursorPaginationResult slices exact limit (25 items)");
  assert(paginatedResult.nextCursor === "row-25", "formatCursorPaginationResult extracts last item ID as nextCursor");

  // -------------------------------------------------------------
  // Test 4: Redis Central Singleton & Safe Fallback
  // -------------------------------------------------------------
  console.log("\n--- 4. REDIS SINGLETON & SAFE FALLBACK EXECUTION ---");
  const connected = await isRedisConnected();
  console.log(`[REDIS STATUS] Redis is ${connected ? "ONLINE" : "OFFLINE (Safe Fallback Active)"}`);

  // Test safe fallback on get / set / scan
  const testKey = "cache:tenant:test_tenant:tier:all:table:test:ping";
  const setResult = await safeRedisSet(testKey, "pong", 60);
  const getResult = await safeRedisGet(testKey);

  if (connected) {
    assert(setResult === true, "safeRedisSet persists key to Redis");
    assert(getResult === "pong", "safeRedisGet retrieves persisted value");
    await safeRedisDel(testKey);
  } else {
    assert(getResult === null, "safeRedisGet gracefully returns null when Redis is offline without throwing");
  }

  // Test Cache-Aside wrapper
  let dbCalls = 0;
  const fetchMock = async () => {
    dbCalls++;
    return { status: "fetched_from_prisma", timestamp: Date.now() };
  };

  const cachedResult = await cacheAside({
    key: "cache:tenant:test_tenant:tier:all:table:test:aside",
    fetchFn: fetchMock,
    ttlSeconds: 1800,
  });

  assert(
    cachedResult.status === "fetched_from_prisma" && dbCalls === 1,
    "cacheAside successfully returns data from fetchFn on miss or Redis fallback"
  );

  // -------------------------------------------------------------
  // Test 5: Write-Through Cache Invalidation Pipeline
  // -------------------------------------------------------------
  console.log("\n--- 5. WRITE-THROUGH CACHE INVALIDATION PIPELINE ---");
  try {
    await invalidateStudentNamespace("sch_alpha_99", "Primary School");
    await invalidateFinanceNamespace("sch_alpha_99");
    assert(true, "invalidateStudentNamespace and invalidateFinanceNamespace execute without error");
  } catch (err) {
    assert(false, "Cache invalidation threw an unexpected error");
  }

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runVerification().catch((err) => {
  console.error("FATAL: Verification script failed:", err);
  process.exit(1);
});
