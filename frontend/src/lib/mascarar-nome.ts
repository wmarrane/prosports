/**
 * Esconde o sobrenome para exibição pública (LGPD): primeiro nome + dez
 * asteriscos, sempre dez. A contagem fixa é de propósito — asteriscos do
 * tamanho real entregariam o formato do nome.
 *
 * Nome de uma palavra só volta intacto: não há sobrenome a esconder.
 *
 * GÊMEO: `backend/src/lib/mascarar-nome.ts` tem o mesmo conteúdo. Mudou aqui,
 * mude lá (mesmo acordo de `compose-subtitulo.ts`).
 */
export function mascararNome(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length < 2) return partes[0] ?? ''
  return `${partes[0]} **********`
}
