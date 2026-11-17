import { basePrisma } from "../src/lib/tenant-prisma";
import { createEnterpriseStaffAction } from "../src/app/[schoolDomain]/(admin)/staff/actions";

async function main() {
  console.log("=== STARTING ENTERPRISE 5-TIER STAFF ONBOARDING VERIFICATION ===");

  // 1. Resolve target schools
  const egede = await basePrisma.school.findFirst({ where: { subdomain: "egede" } });
  const demo = await basePrisma.school.findFirst({ where: { subdomain: "demo" } });
  const sandbox = await basePrisma.school.findFirst({ where: { subdomain: "sandbox" } });

  if (!egede || !demo) {
    console.error("Required test schools (egede, demo) not found!");
    process.exit(1);
  }

  console.log(`Resolved schools: Egede (${egede.id}), Demo (${demo.id}), Sandbox (${sandbox?.id || "N/A"})`);

  // =========================================================================
  // TIER 1: CRECHE - Caregiver
  // =========================================================================
  console.log("\n--- Testing Tier 1: Creche Caregiver Onboarding ---");
  const crecheRes = await createEnterpriseStaffAction("egede", {
    tierCategory: "CRECHE",
    firstName: "Ngozi",
    lastName: "Okonkwo",
    middleName: "Blessing",
    dateOfBirth: "1994-06-15",
    gender: "Female",
    maritalStatus: "Married",
    phone: "08031112233",
    email: "ngozi.okonkwo@egede.bonaveeict.com.ng",
    residentialAddress: "12 Mission Road, Egede, Enugu State",
    state: "Enugu",
    lga: "Udi",
    nin: "12345678901",
    dateOfEmployment: "2024-01-10",
    employmentType: "Full-time",
    departmentName: "Early Years & Creche",
    highestQualification: "Diploma in Early Childhood Education",
    fieldOfStudy: "Early Childhood Care",
    nextOfKinName: "Chinedu Okonkwo",
    nextOfKinRelationship: "Spouse",
    nextOfKinPhone: "08039998877",
    baseSalary: 120000,
    payGrade: "GL 05",
    bankName: "Zenith Bank",
    bankAccountNumber: "1012345678",
    role: "Caregiver",
    assignments: [
      {
        assignmentType: "CrecheCaregiver",
        metadata: {
          assignedGroup: "Toddler Playgroup",
          activities: ["Sensory & Texture Play", "Rhymes & Songs", "Nap & Feeding Routine"],
          ratio: "1:5",
        },
      },
    ],
  });
  console.log("Tier 1 Result:", crecheRes.success ? `SUCCESS (Staff ID: ${crecheRes.data?.staffId || crecheRes.data?.id})` : `FAILED: ${crecheRes.error}`);

  // =========================================================================
  // TIER 2: NURSERY - Nursery Teacher
  // =========================================================================
  console.log("\n--- Testing Tier 2: Nursery Teacher Onboarding ---");
  const nurseryRes = await createEnterpriseStaffAction("egede", {
    tierCategory: "NURSERY",
    firstName: "Amara",
    lastName: "Eze",
    middleName: "Chioma",
    dateOfBirth: "1992-03-22",
    gender: "Female",
    maritalStatus: "Single",
    phone: "08032223344",
    email: "amara.eze@egede.bonaveeict.com.ng",
    residentialAddress: "45 Old Road, Egede, Enugu State",
    state: "Enugu",
    lga: "Udi",
    nin: "23456789012",
    dateOfEmployment: "2023-09-01",
    employmentType: "Full-time",
    departmentName: "Nursery Section",
    highestQualification: "N.C.E (Early Childhood Education)",
    fieldOfStudy: "Early Childhood Care & Education (ECCE)",
    nextOfKinName: "Obinna Eze",
    nextOfKinRelationship: "Brother",
    nextOfKinPhone: "08038887766",
    baseSalary: 145000,
    payGrade: "GL 06",
    bankName: "Access Bank",
    bankAccountNumber: "0123456789",
    role: "Nursery Teacher",
    assignments: [
      {
        assignmentType: "NurseryClassTeacher",
        metadata: {
          className: "Nursery 1",
          learningAreas: ["Literacy & Phonics", "Numeracy & Number Readiness", "Creative Arts"],
        },
      },
    ],
  });
  console.log("Tier 2 Result:", nurseryRes.success ? `SUCCESS (Staff ID: ${nurseryRes.data?.staffId || nurseryRes.data?.id})` : `FAILED: ${nurseryRes.error}`);

  // =========================================================================
  // TIER 3: PRIMARY - Class Teacher (Egede Primary)
  // =========================================================================
  console.log("\n--- Testing Tier 3: Primary Class Teacher (Egede Primary) ---");
  const primaryRes = await createEnterpriseStaffAction("egede", {
    tierCategory: "PRIMARY",
    firstName: "Emeka",
    lastName: "Nnamani",
    middleName: "Paul",
    dateOfBirth: "1988-11-05",
    gender: "Male",
    maritalStatus: "Married",
    phone: "08033334455",
    email: "emeka.nnamani@egede.bonaveeict.com.ng",
    residentialAddress: "8 Onyeama Drive, Egede, Enugu State",
    state: "Enugu",
    lga: "Udi",
    nin: "34567890123",
    dateOfEmployment: "2022-09-15",
    employmentType: "Full-time",
    departmentName: "Primary Section",
    highestQualification: "B.Ed (Bachelor of Education)",
    fieldOfStudy: "Primary Education Studies (PES)",
    institutionAttended: "Enugu State University of Science and Technology",
    yearGraduated: "2015",
    trcnNumber: "TRCN/EN/2016/48201",
    trcnExpiry: "2027-12-31",
    nextOfKinName: "Ifunanya Nnamani",
    nextOfKinRelationship: "Spouse",
    nextOfKinPhone: "08037776655",
    baseSalary: 185000,
    payGrade: "GL 07",
    bankName: "First Bank of Nigeria",
    bankAccountNumber: "3087654321",
    role: "Class Teacher",
    assignments: [
      {
        assignmentType: "ClassTeacher",
        metadata: {
          className: "Primary 4",
          subjects: ["Mathematics", "English Studies", "Basic Science & Technology"],
        },
      },
    ],
  });
  console.log("Tier 3 Result:", primaryRes.success ? `SUCCESS (Staff ID: ${primaryRes.data?.staffId || primaryRes.data?.id})` : `FAILED: ${primaryRes.error}`);

  // =========================================================================
  // TIER 4: SECONDARY - Subject Teacher (Apex International)
  // =========================================================================
  console.log("\n--- Testing Tier 4: Secondary Subject Teacher (Apex) ---");
  const secondaryRes = await createEnterpriseStaffAction("demo", {
    tierCategory: "SECONDARY",
    firstName: "Babatunde",
    lastName: "Fashola",
    middleName: "Olumide",
    dateOfBirth: "1985-04-18",
    gender: "Male",
    maritalStatus: "Married",
    phone: "08034445566",
    email: "babatunde.fashola@apexschools.edu.ng",
    residentialAddress: "15 Admiralty Way, Lekki Phase 1, Lagos",
    state: "Lagos",
    lga: "Eti-Osa",
    nin: "45678901234",
    dateOfEmployment: "2021-08-01",
    employmentType: "Full-time",
    departmentName: "Science Department",
    highestQualification: "B.Sc (Ed) / B.A (Ed)",
    fieldOfStudy: "Physics Education",
    institutionAttended: "University of Lagos",
    yearGraduated: "2010",
    trcnNumber: "TRCN/LA/2012/10982",
    trcnExpiry: "2028-06-30",
    nextOfKinName: "Abimbola Fashola",
    nextOfKinRelationship: "Spouse",
    nextOfKinPhone: "08036665544",
    baseSalary: 240000,
    payGrade: "GL 09",
    bankName: "Guaranty Trust Bank (GTBank)",
    bankAccountNumber: "0219876543",
    role: "Subject Teacher",
    assignments: [
      {
        assignmentType: "SubjectTeacher",
        metadata: {
          className: "SSS 2",
          subjects: ["Physics", "Further Mathematics"],
        },
      },
    ],
  });
  console.log("Tier 4 Result:", secondaryRes.success ? `SUCCESS (Staff ID: ${secondaryRes.data?.staffId || secondaryRes.data?.id})` : `FAILED: ${secondaryRes.error}`);

  // =========================================================================
  // TIER 5: TERTIARY - Senior Lecturer (Apex Polytechnic / Sandbox)
  // =========================================================================
  console.log("\n--- Testing Tier 5: Tertiary Lecturer Onboarding ---");
  const targetTertiaryDomain = sandbox ? "sandbox" : "demo";
  const tertiaryRes = await createEnterpriseStaffAction(targetTertiaryDomain, {
    tierCategory: "TERTIARY",
    firstName: "Dr. Chukwuemeka",
    lastName: "Onyekachi",
    middleName: "Gerald",
    dateOfBirth: "1978-08-12",
    gender: "Male",
    maritalStatus: "Married",
    phone: "08035556677",
    email: "c.onyekachi@apex.edu.ng",
    residentialAddress: "32 University Crescent, Lagos",
    state: "Anambra",
    lga: "Idemili North",
    nin: "56789012345",
    dateOfEmployment: "2019-10-01",
    employmentType: "Full-time",
    departmentName: "Department of Computer Science",
    highestQualification: "Ph.D (Doctor of Philosophy)",
    fieldOfStudy: "Computer Science",
    specialization: "Distributed Systems & Cloud Computing",
    academicRank: "Senior Lecturer",
    institutionAttended: "University of Nigeria, Nsukka",
    yearGraduated: "2008",
    professionalBody: "CPN (Computer Professionals Registration Council of Nigeria)",
    professionalMembershipNo: "CPN/R/2012/0841",
    professionalExpiry: "2027-10-31",
    trcnNumber: "TRCN/HE/2015/0029",
    nextOfKinName: "Dr. Nkemdilim Onyekachi",
    nextOfKinRelationship: "Spouse",
    nextOfKinPhone: "08035554433",
    baseSalary: 480000,
    payGrade: "CONUASS 05",
    bankName: "Stanbic IBTC Bank",
    bankAccountNumber: "0034567891",
    role: "Senior Lecturer",
    assignments: [
      {
        assignmentType: "TertiaryLecturer",
        metadata: {
          faculty: "School of Applied Science & Technology",
          department: "Department of Computer Science",
          programme: "ND Computer Science",
          academicSemester: "1st Semester",
          totalCreditUnits: 9,
          courses: [
            { code: "COM 111", title: "Introduction to Computing", creditUnits: 3, level: "ND 1", semester: "1st Semester" },
            { code: "COM 211", title: "Operating Systems", creditUnits: 3, level: "ND 2", semester: "1st Semester" },
            { code: "CSC 301", title: "Distributed Database Systems", creditUnits: 3, level: "HND 1", semester: "1st Semester" },
          ],
        },
      },
    ],
  });
  console.log("Tier 5 Result:", tertiaryRes.success ? `SUCCESS (Staff ID: ${tertiaryRes.data?.staffId || tertiaryRes.data?.id})` : `FAILED: ${tertiaryRes.error}`);

  console.log("\n=== 5-TIER VERIFICATION COMPLETED ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
