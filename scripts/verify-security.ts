import bcrypt from "bcryptjs";
import { basePrisma } from "../src/lib/tenant-prisma";
import { 
  validatePasswordStrength,
  ensureSecurityTables,
  setUserMustChangePassword,
  isMustChangePassword,
  recordPasswordChange,
  createPasswordResetToken,
  verifyPasswordResetToken,
  completePasswordReset,
  changeUserPassword
} from "../src/lib/security-service";
import { sendPasswordResetEmail } from "../src/lib/email-service";

async function main() {
  console.log("==================================================");
  console.log("RUNNING COMPLETE SECURITY UPGRADE VERIFICATION");
  console.log("==================================================");

  // 1. Password Strength Validation Rules
  console.log("\n[1] Testing Strict Password Input Validation Rules:");
  const testCases = [
    { pwd: "short", expected: false, reason: "Less than 8 characters" },
    { pwd: "alllowercasenonumbers", expected: false, reason: "No numbers" },
    { pwd: "1234567890123", expected: false, reason: "No letters" },
    { pwd: "Password123", expected: true, reason: "Alphanumeric with mixed case" },
    { pwd: "SecureSchoolPass2026!", expected: true, reason: "Alphanumeric with special symbol" },
  ];

  for (const tc of testCases) {
    const res = validatePasswordStrength(tc.pwd);
    if (res.valid !== tc.expected) {
      throw new Error(`Validation mismatch for '${tc.pwd}' (${tc.reason}): expected ${tc.expected}, got ${res.valid}`);
    }
    console.log(`  ✓ Case '${tc.reason}': ${res.valid ? "VALID" : "REJECTED (" + res.error + ")"}`);
  }

  // 2. Database Auto-Provisioning & Security Table Verification
  console.log("\n[2] Testing Security Table Auto-Provisioning:");
  await ensureSecurityTables();
  console.log("  ✓ `bonavee_password_resets` and `bonavee_user_security` verified / auto-provisioned.");

  // 3. Forced Password Reset Flag Operations
  console.log("\n[3] Testing Forced Password Reset State Management:");
  const testUserId = "test-staff-flag-" + Date.now();
  const testSchoolId = "test-school-id";
  
  let initialFlag = await isMustChangePassword(testUserId);
  console.log(`  ✓ Initial mustChangePassword state: ${initialFlag} (expected false)`);
  if (initialFlag !== false) throw new Error("Expected initial flag to be false");

  await setUserMustChangePassword(testUserId, testSchoolId, true);
  let activeFlag = await isMustChangePassword(testUserId);
  console.log(`  ✓ After setUserMustChangePassword(true): ${activeFlag} (expected true)`);
  if (activeFlag !== true) throw new Error("Expected active flag to be true");

  await recordPasswordChange(testUserId, testSchoolId);
  let clearedFlag = await isMustChangePassword(testUserId);
  console.log(`  ✓ After recordPasswordChange(): ${clearedFlag} (expected false)`);
  if (clearedFlag !== false) throw new Error("Expected cleared flag to be false");

  // 4. Temporary School for Real DB Integration
  console.log("\n[4] Setting up temporary test school in database...");
  const tempSchool = await basePrisma.school.upsert({
    where: { subdomain: "test-sec-york" },
    update: {},
    create: {
      name: "York Test Academy",
      subdomain: "test-sec-york",
      slug: "test-sec-york",
      status: "ACTIVE",
      isActive: true,
    }
  });
  console.log(`  ✓ Test school active: ${tempSchool.name} (id: ${tempSchool.id}, subdomain: ${tempSchool.subdomain})`);

  // 5. "Forgot Password" Token & Pipeline Verification
  console.log("\n[5] Testing 'Forgot Password' Token Lifecycle & Tenant Slug Isolation:");
  const staffEmail = `admin-${Date.now()}@york.edu`;

  const token = await createPasswordResetToken({
    schoolId: tempSchool.id,
    userId: testUserId,
    email: staffEmail,
    userType: "STAFF",
    expiresMinutes: 60,
  });

  console.log(`  ✓ Secure token generated: ${token.substring(0, 16)}... (length: ${token.length})`);
  if (token.length !== 64) throw new Error("Expected 64-char crypto token");

  // Verify valid token with correct tenant slug
  const validRecord = await verifyPasswordResetToken(token, tempSchool.subdomain);
  console.log(`  ✓ Token verified for ${validRecord.email} under slug '/${tempSchool.subdomain}'`);
  if (!validRecord.valid || validRecord.email !== staffEmail) {
    throw new Error("Token record properties mismatch or invalid");
  }

  // Verify tenant slug isolation: wrong tenant slug MUST be rejected!
  const wrongSlugRes = await verifyPasswordResetToken(token, "other-foreign-school");
  console.log(`  ✓ Cross-tenant security isolation verified: rejected=${!wrongSlugRes.valid} (${wrongSlugRes.error})`);
  if (wrongSlugRes.valid) throw new Error("Security vulnerability: token accepted for foreign tenant!");

  // 6. Transactional Email Recovery Transmission
  console.log("\n[6] Testing Transactional Email Recovery Pipeline:");
  const recoveryUrl = `https://bonaveeict.com.ng/${tempSchool.subdomain}/reset-password?token=${token}`;
  const mailResult = await sendPasswordResetEmail({
    school: tempSchool,
    recipientEmail: staffEmail,
    recipientName: "Administrator",
    resetUrl: recoveryUrl,
    expiresMinutes: 60,
  });
  console.log(`  ✓ Recovery email generated & logged: success=${mailResult.success} (messageId: ${mailResult.messageId})`);
  if (!mailResult.success) throw new Error("Failed to send password reset email");

  // 7. Password Hash Verification & Change Routine
  console.log("\n[7] Testing Backend Password Verification & Encryption Routine:");
  const oldPasswordRaw = "InitialPassword123";
  const oldHashed = await bcrypt.hash(oldPasswordRaw, 10);
  const testUser = await basePrisma.user.create({
    data: {
      firstName: "Security",
      lastName: "Tester",
      email: staffEmail,
      role: "PRINCIPAL",
      schoolId: tempSchool.id,
      passwordHash: oldHashed,
      mustChangePassword: true,
    }
  });

  const testStaff = await basePrisma.staff.create({
    data: {
      id: testUser.id,
      userId: testUser.id,
      firstName: "Security",
      lastName: "Tester",
      email: staffEmail,
      schoolId: tempSchool.id,
    }
  });

  // Flag user with mustChangePassword
  await setUserMustChangePassword(testStaff.id, tempSchool.id, true);

  // Attempt change with INCORRECT current password -> MUST FAIL
  const wrongOldResult = await changeUserPassword({
    userId: testStaff.id,
    schoolId: tempSchool.id,
    role: "PRINCIPAL",
    currentPassword: "WrongPassword999",
    newPassword: "BrandNewSecurePassword2026",
    confirmPassword: "BrandNewSecurePassword2026",
  });
  console.log(`  ✓ Old password mismatch blocked: success=${wrongOldResult.success} (error: ${wrongOldResult.error})`);
  if (wrongOldResult.success) throw new Error("Security breach: password change allowed with invalid current password!");

  // Attempt change with CORRECT current password and strong new password -> MUST SUCCEED
  const changeResult = await changeUserPassword({
    userId: testStaff.id,
    schoolId: tempSchool.id,
    role: "PRINCIPAL",
    currentPassword: oldPasswordRaw,
    newPassword: "BrandNewSecurePassword2026",
    confirmPassword: "BrandNewSecurePassword2026",
  });
  console.log(`  ✓ Password successfully changed and re-encrypted: ${changeResult.success}`);
  if (!changeResult.success) throw new Error("Password change failed: " + changeResult.error);

  // Verify that mustChangePassword was cleared
  const isStillMustChange = await isMustChangePassword(testStaff.id);
  console.log(`  ✓ Forced reset flag after update: ${isStillMustChange} (expected false)`);
  if (isStillMustChange !== false) throw new Error("mustChangePassword was not cleared after password change");

  // Verify new password hash in database
  const updatedUser = await basePrisma.user.findUnique({ where: { id: testUser.id } });
  const isNewHashValid = await bcrypt.compare("BrandNewSecurePassword2026", updatedUser?.passwordHash || "");
  console.log(`  ✓ New encrypted password hash verified in database: ${isNewHashValid}`);
  if (!isNewHashValid) throw new Error("New password hash does not match new password");

  // 8. Test Token-based Reset
  console.log("\n[8] Testing Password Reset via Recovery Token:");
  const liveToken = await createPasswordResetToken({
    schoolId: tempSchool.id,
    userId: testStaff.id,
    email: staffEmail,
    userType: "STAFF",
    expiresMinutes: 60,
  });

  const resetWithTokenResult = await completePasswordReset(
    liveToken,
    "AnotherNewPassword2026"
  );
  console.log(`  ✓ completePasswordReset completed: success=${resetWithTokenResult.success}`);
  if (!resetWithTokenResult.success) throw new Error("Token-based reset failed: " + resetWithTokenResult.error);

  // Ensure token cannot be reused
  const replayAttempt = await verifyPasswordResetToken(liveToken, tempSchool.subdomain);
  console.log(`  ✓ Token replay protection verified: valid=${replayAttempt.valid} (${replayAttempt.error})`);
  if (replayAttempt.valid) throw new Error("Security breach: used reset token was accepted for replay!");

  // Cleanup test records
  await basePrisma.staff.delete({ where: { id: testStaff.id } });
  await basePrisma.school.delete({ where: { id: tempSchool.id } });

  console.log("\n==================================================");
  console.log("ALL SECURITY UPGRADE VERIFICATIONS PASSED 100%!");
  console.log("==================================================");
  await basePrisma.$disconnect();
}

main().catch(async (err) => {
  console.error("VERIFICATION FAILED:", err);
  await basePrisma.$disconnect();
  process.exit(1);
});
