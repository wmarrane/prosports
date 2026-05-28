import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const senhaHash = await bcrypt.hash('admin123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@prosports.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@prosports.com',
      senha_hash: senhaHash,
      role: 'ADMIN',
    },
  })

  console.log(`Admin criado: ${admin.email}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
