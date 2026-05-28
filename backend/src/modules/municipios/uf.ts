export const UF_NOME_TO_SIGLA: Record<string, string> = {
  'acre': 'AC',
  'alagoas': 'AL',
  'amapa': 'AP',
  'amazonas': 'AM',
  'bahia': 'BA',
  'ceara': 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  'goias': 'GO',
  'maranhao': 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  'para': 'PA',
  'paraiba': 'PB',
  'parana': 'PR',
  'pernambuco': 'PE',
  'piaui': 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  'rondonia': 'RO',
  'roraima': 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  'sergipe': 'SE',
  'tocantins': 'TO',
}

export const SIGLAS_VALIDAS = new Set(Object.values(UF_NOME_TO_SIGLA))

export function normalizarUf(input: string): string | null {
  const cleaned = input.trim()
  if (cleaned.length === 2) {
    const upper = cleaned.toUpperCase()
    return SIGLAS_VALIDAS.has(upper) ? upper : null
  }
  const key = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return UF_NOME_TO_SIGLA[key] ?? null
}
