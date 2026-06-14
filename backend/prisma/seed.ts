import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const senha = process.env.ADMIN_SEED_PASSWORD
  if (!senha) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADMIN_SEED_PASSWORD é obrigatório para seed em produção.')
    }
    console.warn('[seed] ADMIN_SEED_PASSWORD não definido — usando senha de desenvolvimento "admin123". NÃO use em produção.')
  }
  const senhaHash = await bcrypt.hash(senha ?? 'admin123', 12)

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
