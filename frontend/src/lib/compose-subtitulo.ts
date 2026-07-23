import type { Participante } from '../types/participante'

export type CampoSubtitulo = 'subtitulo' | 'municipio' | 'inspetoria' | 'delegacia'

/** Shape mínima de município necessária para compor a linha de subtítulo. */
type MunicipioLike = { nome: string; uf: string }

/** Participante-like para composição de subtítulo; municipio é nullable para suportar overrides. */
type ParticipanteLike = {
  subtitulo: string | null
  municipio: MunicipioLike | null
  inspetoria: Participante['inspetoria']
  delegacia: Participante['delegacia']
}

type InscricaoLike<T extends ParticipanteLike = ParticipanteLike> = {
  subtitulo?: string | null
  municipio?: MunicipioLike | null
  participante: T
}

/** Participante "efetivo" p/ compor o subtítulo: escolar usa o override da inscrição
 *  (fonte única; vazio se null), não-escolar usa o participante. Genérico p/ preservar
 *  o tipo do participante (ex.: `Participante` completo num `Map<number, Participante>`). */
export function participanteEfetivo<T extends ParticipanteLike>(
  insc: InscricaoLike<T>,
  porModalidade: boolean,
): T {
  if (!porModalidade) return insc.participante
  return {
    ...insc.participante,
    subtitulo: insc.subtitulo ?? null,
    municipio: insc.municipio ?? null,
  } as T
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
