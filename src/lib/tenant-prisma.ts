import { PrismaClient } from '@prisma/client'

// Global singleton to avoid connection exhaustion in Next.js dev mode
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const basePrisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

/**
 * Creates a Prisma client extension that automatically isolates
 * queries and mutations to a specific schoolId.
 */
export function getTenantClient(schoolId: string) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantModels = ['Student', 'Staff', 'Classroom', 'Course', 'FeeTemplate', 'Invoice', 'Payment', 'Timetable', 'StudentAttendance', 'StaffAttendance', 'Exam', 'ExamResult', 'Notice', 'MessageLog', 'AcademicTier', 'Department', 'PayrollRecord', 'Transaction', 'AdmissionLead'] // Models requiring isolation
          if (tenantModels.includes(model as string)) {
            if (operation === 'create' || operation === 'createMany') {
              // Create isolation
              if (args.data) {
                if (Array.isArray(args.data)) {
                  (args as any).data = (args.data as any[]).map(d => ({ ...d, schoolId }))
                } else {
                  (args as any).data = { ...(args.data as any), schoolId }
                }
              }
            } else {
              // Read, Update, Delete isolation
              if ((args as any).where) {
                (args as any).where = { ...(args as any).where, schoolId }
              } else {
                (args as any).where = { schoolId }
              }
            }
          }
          
          return query(args)
        }
      }
    }
  })
}
