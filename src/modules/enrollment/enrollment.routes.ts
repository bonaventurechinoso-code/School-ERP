import {
  storeApplication,
  getAllApplications,
  getApplicationById,
  verifyDocument,
  admitApplicant,
  rejectApplicant,
  updateApplicantStatus,
  executeLeadToRegisterTransition,
  findDuplicateAdmissionEntry,
  isAdmissionsAuthorized,
  assertAdmissionsAuthorized,
} from "./enrollment.controller";

export const enrollmentService = {
  storeApplication,
  getAllApplications,
  getApplicationById,
  verifyDocument,
  admitApplicant,
  rejectApplicant,
  updateApplicantStatus,
  executeLeadToRegisterTransition,
  findDuplicateAdmissionEntry,
  isAdmissionsAuthorized,
  assertAdmissionsAuthorized,
};

export default enrollmentService;
