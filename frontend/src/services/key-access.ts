import apiKey from '../lib/api-key'
import type { Evento } from '../types/evento'
import type { Modalidade, TipoDisputa } from '../types/modalidade'
import type { Inscricao } from '../types/inscricao'
import type { CampeaoAnterior } from '../types/campeao-anterior'
import type { Sorteio } from '../types/sorteio'

const BASE = '/key-access'

type LoginPayload = { token: string; email: string; device_fp: string; device_label: string }
type LoginResponse = { keyToken: string; evento: Evento }

export type ModalidadeDetail = {
  modalidade: Modalidade & { tipo_modalidade: { tipo: TipoDisputa } }
  inscritos: Inscricao[]
  campeoes: CampeaoAnterior[]
  sorteio: Sorteio | null
}

export const keyAccessService = {
  login: (data: LoginPayload) =>
    apiKey.post<LoginResponse>(`${BASE}/login`, data).then(r => r.data),
  me: () =>
    apiKey.get<{ evento: Evento; valido: boolean }>(`${BASE}/me`).then(r => r.data),
  modalidades: () =>
    apiKey.get<Modalidade[]>(`${BASE}/modalidades`).then(r => r.data),
  modalidade: (id: number) =>
    apiKey.get<ModalidadeDetail>(`${BASE}/modalidade/${id}`).then(r => r.data),
}
