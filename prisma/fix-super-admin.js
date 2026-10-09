import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main(){
  await prisma.user.updateMany({ where: { role: 'SUPER_ADMIN' }, data: { schoolId: null } })
  console.log('Super admin schoolId set to NULL')
}
main().finally(()=>prisma.$disconnect())
