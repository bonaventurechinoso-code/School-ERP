import * as jose from "jose";

async function verifyCommunications() {
  console.log("=================================================================");
  console.log("   VERIFYING COMMUNICATIONS HUB ON RUNNING DEV SERVER            ");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // Create authorized admin JWT session token with production secret
  const jwtSecret = "schoolerp-secret-key-change-in-production-environments";
  const secret = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new jose.SignJWT({
    role: "ADMIN",
    staffRole: "Principal",
    email: "principal@greenwood.edu.ng",
    schoolDomain: "greenwood",
    permissions: ["manage:all"],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("2h")
    .sign(secret);

  const authHeaders = {
    Cookie: `session=${sessionToken}; activeTier=Primary%20School`,
  };

  // --- TEST 1: Announcements Board Tab ---
  console.log("--- TEST 1: Announcements Board Tab (greenwood/communications?tab=notices) ---");
  const noticesRes = await fetch(`${baseUrl}/greenwood/communications?tab=notices`, {
    headers: authHeaders,
  });
  console.log(`Notices Tab HTTP Status: ${noticesRes.status}`);
  if (noticesRes.status !== 200) {
    throw new Error(`FAIL: Announcements tab returned HTTP ${noticesRes.status}`);
  }
  const noticesHtml = await noticesRes.text();

  const hasAnnouncementsTitle = noticesHtml.includes("Announcements &amp; Bulletins") || noticesHtml.includes("Announcements & Bulletins") || noticesHtml.includes("Announcements Board");
  console.log(`Contains 'Announcements & Bulletins': ${hasAnnouncementsTitle}`);
  if (!hasAnnouncementsTitle) {
    throw new Error("FAIL: Announcements header not found!");
  }

  const hasPostNoticeBtn = noticesHtml.includes("Post Notice");
  console.log(`Contains 'Post Notice' action button: ${hasPostNoticeBtn}`);
  if (!hasPostNoticeBtn) {
    throw new Error("FAIL: Post Notice button not found!");
  }

  const hasAllAudiences = noticesHtml.includes("All Audiences");
  console.log(`Contains Audience Filter ('All Audiences'): ${hasAllAudiences}`);
  if (!hasAllAudiences) {
    throw new Error("FAIL: Audience filter not found!");
  }

  console.log("✅ PASS: Announcements Board view rendered successfully with full controls.\n");

  // --- TEST 2: Message Center & Logs Tab ---
  console.log("--- TEST 2: Message Center & Logs Tab (greenwood/communications?tab=logs) ---");
  const logsRes = await fetch(`${baseUrl}/greenwood/communications?tab=logs`, {
    headers: authHeaders,
  });
  console.log(`Logs Tab HTTP Status: ${logsRes.status}`);
  if (logsRes.status !== 200) {
    throw new Error(`FAIL: Message logs tab returned HTTP ${logsRes.status}`);
  }
  const logsHtml = await logsRes.text();

  const hasDirectMessageTitle = logsHtml.includes("Direct Message &amp; Audit Center") || logsHtml.includes("Direct Message & Audit Center") || logsHtml.includes("Message Center");
  console.log(`Contains 'Direct Message & Audit Center': ${hasDirectMessageTitle}`);
  if (!hasDirectMessageTitle) {
    throw new Error("FAIL: Direct Message center header not found!");
  }

  const hasComposeBtn = logsHtml.includes("Compose Message");
  console.log(`Contains 'Compose Message' button: ${hasComposeBtn}`);
  if (!hasComposeBtn) {
    throw new Error("FAIL: Compose Message button not found!");
  }

  const hasChannelFilter = logsHtml.includes("All Channels");
  console.log(`Contains Channel Filter ('All Channels'): ${hasChannelFilter}`);
  if (!hasChannelFilter) {
    throw new Error("FAIL: Channel filter not found!");
  }

  const hasRecipientFilter = logsHtml.includes("All Recipients");
  console.log(`Contains Recipient Filter ('All Recipients'): ${hasRecipientFilter}`);
  if (!hasRecipientFilter) {
    throw new Error("FAIL: Recipient filter not found!");
  }

  console.log("✅ PASS: Message Center & Audit Logs rendered successfully with full filters.\n");

  // --- TEST 3: Academic Tier Scoping Navigation ---
  console.log("--- TEST 3: Academic Tier Parameter Navigation ---");
  const secondaryRes = await fetch(`${baseUrl}/greenwood/communications?tab=notices&tier=Secondary+School`, {
    headers: {
      Cookie: `session=${sessionToken}; activeTier=Secondary%20School`,
    },
  });
  console.log(`Secondary Tier HTTP Status: ${secondaryRes.status}`);
  const secondaryHtml = await secondaryRes.text();
  const hasSecondaryTierBadge = secondaryHtml.includes("Secondary School");
  console.log(`Contains 'Secondary School' tier badge: ${hasSecondaryTierBadge}`);
  if (!hasSecondaryTierBadge) {
    throw new Error("FAIL: Secondary School tier badge not rendered!");
  }

  console.log("✅ PASS: Academic tier parameter navigation verified.\n");

  console.log("=================================================================");
  console.log("  ALL COMMUNICATIONS HUB CHECKS PASSED (3/3)                      ");
  console.log("=================================================================\n");
}

verifyCommunications()
  .catch((err) => {
    console.error("❌ Verification failed:", err.message);
    process.exit(1);
  });
