import type { Participante } from '../types/participante'

export type CampoSubtitulo = 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'

type ParticipanteLike = Pick<
  Participante,
  'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'
>

type InscricaoLike = {
  subtitulo?: string | null
  municipio?: { nome: string; uf: string } | null
  participante: ParticipanteLike
}

/** Participante "efetivo" p/ compor o subtítulo: escolar usa o override da inscrição
 *  (fonte única; vazio se null), não-escolar usa o participante. */
export function participanteEfetivo(insc: InscricaoLike, porModalidade: boolean): ParticipanteLike {
  if (!porModalidade) return insc.participante
  return {
    ...insc.participante,
    subtitulo: insc.subtitulo ?? null,
    municipio: insc.municipio ?? null,
  }
}

/**
 * Compõe a "linha de info adicional" de um participante, juntando os campos
 * selecionados na ordem definida, separados por ` | `. Campos vazios/null
 * são omitidos silenciosamente. Retorna `null` se nenhum campo compõe.
 */
export function composeSubtituloLine(
  p: ParticipanteLike,
  campos: CampoSubtitulo[],
): string | null {
  const partes: string[] = []
  for (const c of campos) {
    let v: string | null = null
    if (c === 'subtitulo') v = p.subtitulo || null
    else if (c === 'municipio' && p.municipio) v = `${p.municipio.nome}/${p.municipio.uf}`
    else if (c === 'inspetoria' && p.inspetoria) v = p.inspetoria.nome
    else if (c === 'delegacia' && p.delegacia) v = p.delegacia.nome
    if (v) partes.push(v)
  }
  return partes.length > 0 ? partes.join(' | ') : null
}
