import { Prisma } from '@prisma/client';

export type StudentStatus = "PROSPECT" | "APPLICANT" | "SCREENED" | "ENROLLED" | "SUSPENDED" | "EXPELLED" | "ALUMNI";
export type StaffStatus = "ONBOARDING" | "ACTIVE" | "LEAVE" | "OFFBOARDED" | "TERMINATED";

// ------------------------------------------------------
// 1. STATE MACHINE TRANSITION RULES
// ------------------------------------------------------

const ALLOWED_STUDENT_TRANSITIONS: Record<StudentStatus, StudentStatus[]> = {
  PROSPECT: ['APPLICANT'],
  APPLICANT: ['SCREENED', 'PROSPECT'],
  SCREENED: ['ENROLLED', 'APPLICANT'],
  ENROLLED: ['SUSPENDED', 'EXPELLED', 'ALUMNI'],
  SUSPENDED: ['ENROLLED', 'EXPELLED'],
  EXPELLED: [], // Terminal state
  ALUMNI: []    // Terminal state
};

const ALLOWED_STAFF_TRANSITIONS: Record<StaffStatus, StaffStatus[]> = {
  ONBOARDING: ['ACTIVE', 'OFFBOARDED', 'TERMINATED'],
  ACTIVE: ['LEAVE', 'OFFBOARDED', 'TERMINATED'],
  LEAVE: ['ACTIVE', 'OFFBOARDED', 'TERMINATED'],
  OFFBOARDED: [], // Terminal state
  TERMINATED: []  // Terminal state
};

// ------------------------------------------------------
// 2. LIFECYCLE HANDLERS
// ------------------------------------------------------

export function transitionStudentState(
  currentStatus: string,
  targetStatus: string
): Prisma.StudentUpdateInput {
  
  const current = currentStatus as StudentStatus;
  const target = targetStatus as StudentStatus;

  // 1. Validate State Jump
  if (!ALLOWED_STUDENT_TRANSITIONS[current]?.includes(target)) {
    throw new Error(`Invalid Student Lifecycle transition: Cannot move from ${currentStatus} to ${targetStatus}.`);
  }

  // 2. Prepare Payload
  const updatePayload: Prisma.StudentUpdateInput = {
    status: target,
  };

  // 3. Inject Audit Timestamps
  const now = new Date();
  switch (target) {
    case 'PROSPECT':
      updatePayload.prospectAt = now;
      break;
    case 'APPLICANT':
      updatePayload.applicantAt = now;
      break;
    case 'SCREENED':
      updatePayload.screenedAt = now;
      break;
    case 'ENROLLED':
      updatePayload.enrolledAt = now;
      break;
    case 'SUSPENDED':
      updatePayload.suspendedAt = now;
      break;
    case 'EXPELLED':
      updatePayload.expelledAt = now;
      break;
    case 'ALUMNI':
      updatePayload.alumniAt = now;
      break;
  }

  return updatePayload;
}

export function transitionStaffState(
  currentStatus: string,
  targetStatus: string,
  complianceChecksPassed: boolean = true
): Prisma.StaffUpdateInput {
  
  const current = currentStatus as StaffStatus;
  const target = targetStatus as StaffStatus;

  // 1. Validate State Jump
  if (!ALLOWED_STAFF_TRANSITIONS[current]?.includes(target)) {
    throw new Error(`Invalid Staff Lifecycle transition: Cannot move from ${currentStatus} to ${targetStatus}.`);
  }

  // 2. Enforce Compliance Rules
  if (target === 'ACTIVE' && !complianceChecksPassed) {
    throw new Error("Compliance Violation: Cannot activate a staff member without passing required compliance checks.");
  }

  // 3. Prepare Payload
  const updatePayload: Prisma.StaffUpdateInput = {
    status: target,
  };

  // 4. Inject Audit Timestamps
  const now = new Date();
  switch (target) {
    case 'ONBOARDING':
      updatePayload.onboardingAt = now;
      break;
    case 'ACTIVE':
      updatePayload.activeAt = now;
      break;
    case 'LEAVE':
      updatePayload.leaveAt = now;
      break;
    case 'OFFBOARDED':
      updatePayload.offboardedAt = now;
      break;
    case 'TERMINATED':
      updatePayload.terminatedAt = now;
      break;
  }

  return updatePayload;
}
