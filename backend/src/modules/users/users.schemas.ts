import { z } from 'zod'

const roleEnum = z.enum(['ADMIN', 'PARTICIPANTE', 'VIEWER', 'COMISSAO_TECNICA'])

export const createSchema = z.object({
  nome: z.string().min(2).max(80),
  email: z.string().email(),
  role: roleEnum,
  senha: z.string().min(8).max(72),
})

export const updateSchema = z.object({
  nome: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  role: roleEnum.optional(),
  ativo: z.boolean().optional(),
})

export const resetarSenhaSchema = z.object({
  nova_senha: z.string().min(8).max(72),
})
