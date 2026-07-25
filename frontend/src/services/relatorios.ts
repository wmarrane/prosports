import api from './api'

function extractFilename(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback
  const m = /filename="([^"]+)"/.exec(disposition) || /filename=([^;]+)/.exec(disposition)
  return m?.[1]?.trim() ?? fallback
}

export const relatoriosService = {
  // `params` carrega os valores legados do JEESP (só usados quando a competição
  // do evento é escolar; nos demais eventos vai vazio e nada muda).
  congresso: async (
    eventoId: number,
    params?: Record<string, string | number>,
  ): Promise<{ blob: Blob; filename: string }> => {
    const r = await api.get(`/relatorios/eventos/${eventoId}/congresso`, {
      params,
      responseType: 'blob',
    })
    return {
      blob: r.data,
      filename: extractFilename(r.headers['content-disposition'], `Congresso_evento_${eventoId}.xlsx`),
    }
  },
}
