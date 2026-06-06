export type SnapParticipante = { id: number; nome: string; subtitulo: string | null }
export type SnapCampeao = { participanteId: number; posicao: number }
export type SnapModalidade = {
  id: number; nome: string; grupo: string | null
  tipo: 'grupos' | 'chaves' | 'ordem_entrada' | 'especifico'
  status: 'sorteado' | 'aguardando'
  seed: string | null; anfitriaoId: number | null
  participantes: SnapParticipante[]; campeoes: SnapCampeao[]
  cabecasPids: number[]; resultado: unknown | null
}
export type SnapEvento = {
  id: number; nome: string; competicao: string; esporte: string
  cidade: string; local: string; data: string; organizador: string | null
  publicadoEm: string; modalidades: SnapModalidade[]
}
