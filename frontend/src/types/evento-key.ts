export type EventoKey = {
  id: number
  token: string
  email: string
  evento_id: number
  device_fp: string | null
  device_label: string | null
  first_used_at: string | null
  last_seen_at: string | null
  revogado_em: string | null
  criado_em: string
  criada_por: number
}
