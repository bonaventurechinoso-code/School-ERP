import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const firstNames = ["Emeka", "Amina", "Oluwaseun", "Chioma", "Chinedu", "Fatima", "Ayodeji", "Ngozi", "Tunde", "Zainab", "Kelechi", "Adeola", "Musa", "Blessing", "Chukwudi", "Ifeoma", "Abubakar", "Funke", "Nnamdi", "Binta"]
const lastNames = ["Adebayo", "Okafor", "Danjuma", "Chukwu", "Balogun", "Ibrahim", "Okoro", "Adeyemi", "Eze", "Mohammed", "Ogunleye", "Nwosu", "Abiola", "Aliyu", "Obi", "Ojo", "Umar", "Akinyemi", "Nwachukwu", "Sanusi"]
const states = ["Lagos", "Kano", "Rivers", "Kaduna", "Oyo", "Abuja", "Enugu", "Delta", "Anambra", "Edo"]
const occupations = ["Engineer", "Trader", "Civil Servant", "Teacher", "Doctor", "Businesswoman", "Banker", "Lawyer", "Contractor", "Farmer"]

const getRandomItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)]
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

async function main() {
  console.log("Seeding database with Nigerian mock data...")

  // Clean the database
  await prisma.admissionLead.deleteMany()
  await prisma.examResult.deleteMany()
  await prisma.exam.deleteMany()
  await prisma.student.deleteMany()
  await prisma.course.deleteMany()
  await prisma.classroom.deleteMany()
  await prisma.academicTier.deleteMany()
  await prisma.school.deleteMany()
  await prisma.platformAdmin.deleteMany()

  // Seed Platform Admin
  await prisma.platformAdmin.create({
    data: {
      email: "admin@schoolerp.com",
      password: "hashed_password_placeholder", // Typically use bcrypt here
    },
  })

  const schoolsConfig = [
    { name: "Demo School", subdomain: "demo", tiers: ["Day Care / Nursery", "Primary School", "Secondary School", "Higher Institution / University"] },
    { name: "Greenwood Academy", subdomain: "greenwood", tiers: ["Day Care / Nursery", "Primary School", "Secondary School"] },
    { name: "Summit High School", subdomain: "summit", tiers: ["Secondary School"] },
    { name: "Riverside University", subdomain: "riverside", tiers: ["Higher Institution / University"] },
  ]

  for (const s of schoolsConfig) {
    const school = await prisma.school.create({
      data: {
        name: s.name,
        subdomain: s.subdomain,
        isActive: true,
      },
    })
    console.log(`Created School: ${school.name}`)

    let studentCount = 1

    for (let tIndex = 0; tIndex < s.tiers.length; tIndex++) {
      const tierName = s.tiers[tIndex]
      const tier = await prisma.academicTier.create({
        data: {
          name: tierName,
          schoolId: school.id,
          level: tIndex + 1
        }
      })

      let classes: string[] = []
      if (tierName === "Day Care / Nursery") classes = ["Day Care / Nursery", "Nursery 1", "Nursery 2"]
      else if (tierName === "Primary School") classes = ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"]
      else if (tierName === "Secondary School") classes = ["JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3"]
      else if (tierName === "Higher Institution / University") classes = ["100 Level", "200 Level", "300 Level", "400 Level"]

      for (const className of classes) {
        await prisma.classroom.create({
          data: {
            name: className,
            capacity: 30,
            schoolId: school.id,
            tierId: tier.id
          }
        })
      }

      // Generate 15-20 Enrolled Students per Tier
      const numStudents = getRandomInt(15, 20)
      
      // We will create a Course and an Exam for Secondary School CA tests
      let courseId = ""
      let examId = ""
      if (tierName === "Secondary School") {
        const course = await prisma.course.create({
          data: {
            name: "Mathematics",
            code: "MATH101",
            schoolId: school.id,
            tierId: tier.id
          }
        })
        courseId = course.id
        
        const exam = await prisma.exam.create({
          data: {
            schoolId: school.id,
            courseId: course.id,
            name: "Terminal Assessment",
            semester: "First Term",
            date: new Date(),
            maxScore: 100
          }
        })
        examId = exam.id
      }

      for (let i = 0; i < numStudents; i++) {
        const firstName = getRandomItem(firstNames)
        const lastName = getRandomItem(lastNames)
        const parentName = `Mr/Mrs ${lastName}`
        const currentClass = getRandomItem(classes)
        const isHigherEd = tierName === "Higher Institution / University"
        
        const prefix = school.subdomain.toUpperCase().substring(0, 3)
        const seq = String(studentCount).padStart(3, '0')
        const admissionNumber = `${prefix}/2026/${seq}`
        studentCount++

        const student = await prisma.student.create({
          data: {
            schoolId: school.id,
            tierId: tier.id,
            firstName,
            lastName,
            email: isHigherEd ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${school.subdomain}.edu.ng` : null,
            status: "ENROLLED",
            admissionNumber,
            currentClass,
            dateOfBirth: new Date(new Date().setFullYear(new Date().getFullYear() - getRandomInt(10, 20))),
            stateOfOrigin: getRandomItem(states),
            parentName,
            parentOccupation: getRandomItem(occupations),
            parentEmail: `parent_${lastName.toLowerCase()}@gmail.com`,
            parentPhone: `+234${getRandomInt(7000000000, 9999999999)}`,
            parentWhatsApp: `+234${getRandomInt(7000000000, 9999999999)}`,
          }
        })

        // If Secondary School, insert ExamResult with CA scores
        if (tierName === "Secondary School" && examId) {
          const ca1 = getRandomInt(8, 15)
          const ca2 = getRandomInt(8, 15)
          const examScore = getRandomInt(30, 70)
          const total = ca1 + ca2 + examScore
          
          let letterGrade = "F9"
          if (total >= 75) letterGrade = "A1"
          else if (total >= 70) letterGrade = "B2"
          else if (total >= 65) letterGrade = "B3"
          else if (total >= 60) letterGrade = "C4"
          else if (total >= 55) letterGrade = "C5"
          else if (total >= 50) letterGrade = "C6"
          else if (total >= 45) letterGrade = "D7"
          else if (total >= 40) letterGrade = "E8"

          await prisma.examResult.create({
            data: {
              schoolId: school.id,
              examId: examId,
              studentId: student.id,
              score: total,
              ca1Score: ca1,
              ca2Score: ca2,
              examScore: examScore,
              letterGrade: letterGrade
            }
          })
        }
      }

      // Generate 5-10 Alumni Students per Tier
      const numAlumni = getRandomInt(5, 10)
      for (let i = 0; i < numAlumni; i++) {
        const firstName = getRandomItem(firstNames)
        const lastName = getRandomItem(lastNames)
        const currentClass = getRandomItem(classes)
        
        const prefix = school.subdomain.toUpperCase().substring(0, 3)
        const seq = String(studentCount).padStart(3, '0')
        const admissionNumber = `${prefix}/2026/${seq}`
        studentCount++

        await prisma.student.create({
          data: {
            schoolId: school.id,
            tierId: tier.id,
            firstName,
            lastName,
            status: "ALUMNI",
            admissionNumber,
            currentClass,
            dateOfBirth: new Date(new Date().setFullYear(new Date().getFullYear() - getRandomInt(18, 30))),
            stateOfOrigin: getRandomItem(states),
            parentName: `Mr/Mrs ${lastName}`,
          }
        })
      }

      // Generate 2-3 Suspended Students per Tier
      const numSuspended = getRandomInt(2, 3)
      for (let i = 0; i < numSuspended; i++) {
        const firstName = getRandomItem(firstNames)
        const lastName = getRandomItem(lastNames)
        const currentClass = getRandomItem(classes)
        
        const prefix = school.subdomain.toUpperCase().substring(0, 3)
        const seq = String(studentCount).padStart(3, '0')
        const admissionNumber = `${prefix}/2026/${seq}`
        studentCount++

        await prisma.student.create({
          data: {
            schoolId: school.id,
            tierId: tier.id,
            firstName,
            lastName,
            status: "SUSPENDED",
            admissionNumber,
            currentClass,
            dateOfBirth: new Date(new Date().setFullYear(new Date().getFullYear() - getRandomInt(10, 20))),
            stateOfOrigin: getRandomItem(states),
            parentName: `Mr/Mrs ${lastName}`,
          }
        })
      }

      // Generate Admission Leads per Tier including APPROVED and ENROLLED
      const leadStatuses = [
        "INQUIRY", "INQUIRY", 
        "APPLIED", "APPLIED", 
        "INTERVIEW", "INTERVIEW", 
        "APPROVED", "APPROVED", "APPROVED", 
        "ENROLLED", "ENROLLED"
      ];
      
      for (let i = 0; i < leadStatuses.length; i++) {
        const firstName = getRandomItem(firstNames)
        const lastName = getRandomItem(lastNames)
        await prisma.admissionLead.create({
          data: {
            schoolId: school.id,
            tierId: tier.id,
            applicantName: `${firstName} ${lastName}`,
            parentContact: `+234${getRandomInt(7000000000, 9999999999)}`,
            parentName: `Mr/Mrs ${lastName}`,
            targetGrade: getRandomItem(classes),
            status: leadStatuses[i],
            source: "Website",
          }
        })
      }
    }
  }

  console.log("Seeding complete! Databases are heavily populated.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
