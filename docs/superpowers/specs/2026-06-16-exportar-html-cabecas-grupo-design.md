# Exportar HTML: listar todos os cabeças (grupo só nos cabeças de grupo) — Design

**Data:** 2026-06-16
**Status:** Aprovado (revisado — substitui a 1ª versão)

## Problema

No relatório "Exportar HTML" (e no "Imprimir") de modalidades de **grupos**, queremos uma seção "Cabeças" que liste **todos os cabeças** e marque, **apenas nos que serão cabeças de grupo**, em qual grupo entrarão:

```
Cabeças
1. Lençóis Paulista - Grupo A
2. Fulano - Grupo B
3. Cidade Anfitriã - Grupo C
4. Sicrano
```
(Item 4 é um cabeça que não encabeça grupo → sem rótulo de grupo.)

A 1ª implementação (commit `7882d12`) está **incorreta**: listou somente os cabeças de grupo. Esta versão corrige.

## Semântica correta (igual ao banner do congresso `cabecasComGrupo`)

- **Lista de cabeças** = **todos os campeões do ano anterior** (ordenados por posição), incluindo não inscritos, **mais o anfitrião** como entrada sintética quando a regra se aplica (`considerar_anfitriao` da competição **e** anfitrião inscrito **e** ainda não é campeão). Ordem: campeões por posição; anfitrião sintético ao final.
- **Cabeça de grupo** (recebe "- Grupo X"): determinado pela **regra determinística** do engine, não pelo "1º do grupo" (evita falso-positivo de campeão excedente sorteado no topo). Usa `applyAnfitriaoRuleFront(campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, considerar_anfitriao, 'grupos', numGrupos)`; a cabeça de índice `i` (para `i < numGrupos`) encabeça o grupo `grupos[i].letra` (A, B, C…).

## Contexto (código)

- Relatório: `frontend/src/pages/eventos/SorteioPrint.tsx` (`SorteioPrintContent`), usado em dois lugares de `frontend/src/pages/eventos/EventoInscricoes.tsx`: o loop de Exportar HTML (~linha 302-333) e o `SorteioPrint` da tela (~linha 1057-1074).
- `applyAnfitriaoRuleFront` e `grupoLetra`: `frontend/src/lib/anfitriao-rule.ts` (espelho do engine backend).
- `evento.competicao.considerar_anfitriao` está disponível em `EventoInscricoes` (buscarPorId inclui `competicao: true`).
- Dados por modalidade nos dois call sites: campeões (`participante_id`, `posicao`, `participante.nome`), inscritos (lista), `anfitriao_id`/`anfitriao.nome`, `resultado` (grupos).

## Mudanças

### 1. Novo helper puro `frontend/src/lib/cabecas-grupo.ts`
```ts
import { applyAnfitriaoRuleFront } from './anfitriao-rule'

export type CabecaCampeao = { participante_id: number; posicao: number; nome: string }

export function cabecasComGrupo(args: {
  campeoes: CabecaCampeao[]                 // todos os campeões (qualquer ordem)
  inscritosIds: Set<number>
  anfitriaoPid: number | null
  anfitriaoNome: string | null
  consideraAnfitriao: boolean
  grupos: { letra: string; participantes: number[] }[] | null   // null se não sorteado/não-grupos
}): { nome: string; grupo: string | null }[] {
  const { campeoes, inscritosIds, anfitriaoPid, anfitriaoNome, consideraAnfitriao, grupos } = args
  const ordenados = [...campeoes].sort((a, b) => a.posicao - b.posicao)
  const anfitriaoInscrito = anfitriaoPid != null && inscritosIds.has(anfitriaoPid)
  const anfitriaoEhCampeao = anfitriaoPid != null && ordenados.some(c => c.participante_id === anfitriaoPid)

  const itens: { pid: number; nome: string }[] = ordenados.map(c => ({ pid: c.participante_id, nome: c.nome }))
  if (consideraAnfitriao && anfitriaoInscrito && anfitriaoPid != null && !anfitriaoEhCampeao) {
    itens.push({ pid: anfitriaoPid, nome: anfitriaoNome ?? '—' })
  }

  const headMap = new Map<number, string>()
  if (grupos && grupos.length > 0) {
    const campeoesInscritosPids = ordenados
      .filter(c => inscritosIds.has(c.participante_id))
      .map(c => c.participante_id)
    const cabecaList = applyAnfitriaoRuleFront(
      campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, 'grupos', grupos.length,
    )
    const n = Math.min(cabecaList.length, grupos.length)
    for (let g = 0; g < n; g++) headMap.set(cabecaList[g], grupos[g].letra)
  }

  return itens.map(it => ({ nome: it.nome, grupo: headMap.has(it.pid) ? `Grupo ${headMap.get(it.pid)}` : null }))
}
```

### 2. `SorteioPrint.tsx` — receber e renderizar `cabecas`
- Remover a derivação atual (errada) dentro de `SorteioPrintContent`.
- Adicionar prop opcional `cabecas?: { nome: string; grupo: string | null }[]`.
- Renderizar, **acima** do `<SorteioGrupos>`, quando `cabecas?.length`:
```tsx
{p.cabecas && p.cabecas.length > 0 && (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Cabeças</div>
    <ol style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
      {p.cabecas.map((c, i) => <li key={i}>{c.nome}{c.grupo ? ` - ${c.grupo}` : ''}</li>)}
    </ol>
  </div>
)}
```

### 3. `EventoInscricoes.tsx` — montar `cabecas` nos dois call sites
Em ambos (loop do Exportar HTML e `SorteioPrint` da tela), calcular e passar `cabecas` **somente para grupos sorteados**:
```ts
const grupos = tipo === 'grupos' && sorteio?.resultado ? (sorteio.resultado as any).grupos ?? null : null
const cabecas = grupos ? cabecasComGrupo({
  campeoes: camps.map(c => ({ participante_id: c.participante_id, posicao: c.posicao, nome: c.participante?.nome ?? '—' })),
  inscritosIds: new Set(insc.map(i => i.participante_id)),
  anfitriaoPid: evento.anfitriao_id ?? null,
  anfitriaoNome: evento.anfitriao?.nome ?? null,
  consideraAnfitriao: evento.competicao?.considerar_anfitriao ?? false,
  grupos,
}) : undefined
```
(No call site da tela, usar as fontes equivalentes já presentes: `campeoes`, `inscricoes`, `evento`, `sorteioDaModalidade.resultado`.)

## Testes / Verificação

- **Unitário** `frontend/src/lib/cabecas-grupo.test.ts` (Vitest):
  - 3 campeões inscritos, 3 grupos, sem anfitrião → todos com Grupo A/B/C na ordem.
  - anfitrião considerado e inscrito (não-campeão), 3 grupos → anfitrião sintético no fim, rótulo "Grupo C"; campeões 1,2 em A,B.
  - 4 campeões, 3 grupos → o 4º campeão aparece **sem** grupo (excedente).
  - campeão não inscrito → listado **sem** grupo.
  - grupos = null → todos sem grupo.
- `npm run build` (frontend). Verificação manual: Exportar HTML de evento com grupos sorteados mostra todos os cabeças, grupo só nos cabeças de grupo.
- Sem backend/migration.

## Fora de escopo

- Chaves/ordem_entrada (a noção "Grupo X" não se aplica).
- Marcar visualmente campeões não inscritos (apenas listados sem grupo).
- Alterar engine/regra do anfitrião/banner do congresso.
