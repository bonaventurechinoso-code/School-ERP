import {
  storeApplication,
  getAllApplications,
  getApplicationById,
  verifyDocument,
  admitApplicant,
  rejectApplicant,
} from "./enrollment.controller";

export const enrollmentService = {
  storeApplication,
  getAllApplications,
  getApplicationById,
  verifyDocument,
  admitApplicant,
  rejectApplicant,
};

export default enrollmentService;
