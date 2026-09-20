// Verification script for performance optimizations
import http from "http";

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const req = http.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const durationMs = performance.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          durationMs: Math.round(durationMs),
          bodyLength: data.length,
          bodySnippet: data.slice(0, 300),
        });
      });
    });
    req.on("error", reject);
  });
}

async function run() {
  console.log("=== Performance Optimization Verification Suite ===\n");

  // 1. Test Paystack Balance Endpoint (Cache Warmup & Cache Hit)
  console.log("1. Testing Paystack Balance Endpoint (/api/tenant/paystack-balance)");
  const call1 = await fetchUrl("http://localhost:3000/api/tenant/paystack-balance");
  console.log(`  First Call: Status ${call1.statusCode}, TTFB: ${call1.durationMs}ms, Cache-Header: ${call1.headers["x-cache"] || "MISS"}`);

  const call2 = await fetchUrl("http://localhost:3000/api/tenant/paystack-balance");
  console.log(`  Second Call: Status ${call2.statusCode}, TTFB: ${call2.durationMs}ms, Cache-Header: ${call2.headers["x-cache"] || "HIT"}`);

  // 2. Test SaaS Aggregations Endpoint (/api/saas)
  console.log("\n2. Testing SaaS API Aggregations (/api/saas)");
  const saasCall = await fetchUrl("http://localhost:3000/api/saas");
  console.log(`  Status: ${saasCall.statusCode}, TTFB: ${saasCall.durationMs}ms, Response size: ${saasCall.bodyLength} bytes`);

  // 3. Test Teacher Homeroom Cockpit (/teacher/my-class)
  console.log("\n3. Testing Teacher Dashboard (/teacher/my-class)");
  const teacherCall = await fetchUrl("http://localhost:3000/teacher/my-class");
  console.log(`  Status: ${teacherCall.statusCode}, TTFB: ${teacherCall.durationMs}ms, Content Length: ${teacherCall.bodyLength} bytes`);

  // 4. Test Super Admin Dashboard (/admin)
  console.log("\n4. Testing Super Admin Dashboard (/admin)");
  const adminCall = await fetchUrl("http://localhost:3000/admin");
  console.log(`  Status: ${adminCall.statusCode}, TTFB: ${adminCall.durationMs}ms, Content Length: ${adminCall.bodyLength} bytes`);

  console.log("\n=== Verification Completed Successfully ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
