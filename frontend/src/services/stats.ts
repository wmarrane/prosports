import api from './api'

export type PublicStats = {
  inscritos_ativos: number
  sorteios_realizados: number
  eventos_sorteados: number
}

export const statsService = {
  publicas: () => api.get<PublicStats>('/stats/public').then(r => r.data),
}
