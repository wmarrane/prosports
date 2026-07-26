import api from './api'

function extractFilename(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback
  const m = /filename="([^"]+)"/.exec(disposition) || /filename=([^;]+)/.exec(disposition)
  return m?.[1]?.trim() ?? fallback
}

export const relatoriosService = {
  congresso: async (eventoId: number): Promise<{ blob: Blob; filename: string }> => {
    const r = await api.get(`/relatorios/eventos/${eventoId}/congresso`, {
      responseType: 'blob',
    })
    return {
      blob: r.data,
      filename: extractFilename(r.headers['content-disposition'], `Congresso_evento_${eventoId}.xlsx`),
    }
  },
}
