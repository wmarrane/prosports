import api from './api'
import type { EventoKey } from '../types/evento-key'

const base = (eventoId: number) => `/eventos/${eventoId}/keys`

export const eventoKeysService = {
  listar: (eventoId: number) =>
    api.get<EventoKey[]>(base(eventoId)).then(r => r.data),
  criar: (eventoId: number, email: string) =>
    api.post<EventoKey>(base(eventoId), { email }).then(r => r.data),
  revogar: (eventoId: number, keyId: number) =>
    api.post<EventoKey>(`${base(eventoId)}/${keyId}/revoke`).then(r => r.data),
  resetDevice: (eventoId: number, keyId: number) =>
    api.post<EventoKey>(`${base(eventoId)}/${keyId}/reset-device`).then(r => r.data),
  apagar: (eventoId: number, keyId: number) =>
    api.delete(`${base(eventoId)}/${keyId}`),
}
