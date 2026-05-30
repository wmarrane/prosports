# Bracket de Eliminação Simples — Render em Árvore — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.17.0

## Objetivo

Substituir o render flat (lista de slots numerados) de `SorteioChaves` por um bracket visual em árvore por rodadas — pares na 1ª rodada, placeholders "TBD" nas rodadas seguintes, layout em colunas horizontais (estilo bracket clássico de torneio).

## Escopo

- **In:**
  - Reescrita do componente `frontend/src/components/sorteio-result/SorteioChaves.tsx`.
  - Cálculo client-side: pad com nulls até `nextPow2(N)`, gerar rounds, mapear matches.
  - Labels semânticos: Final / Semifinal / Quartas / Oitavas / Nª Rodada.
  - BYE no round 0 exibido em itálico dim.
  - Reuso da prop `large` (Datashow) e `campeoesByParticipanteId` (badge).
- **Out:**
  - Linhas/conectores SVG entre cards (visual elaborado).
  - Persistir resultados de cada rodada (winners) no banco — backend não mexido.
  - Edição manual de vencedores (clicar para marcar).
  - Mudança no `drawBracket` ou no shape do `Sorteio.resultado`.
  - Reforço explícito da constraint "chaves não pode ter grupos" (já garantida pelo service.executar — sem mudança backend).

## Domínio

O backend já posiciona cabeças do bracket nas posições definidas em `sistema_disputas_chaves`. Frontend recebe array `slots` flat de tamanho N (= número de inscritos). Para visualizar como árvore de eliminação simples, expande para `pot2 = nextPow2(N)` adicionando nulls (BYEs) ao final, e gera rodadas:

- Round 0: pares `(0,1), (2,3), ..., (pot2-2, pot2-1)`. Total = pot2/2 matches.
- Round 1: pot2/4 matches (vencedores TBD).
- ...
- Round final: 1 match.

Total de rodadas = `log2(pot2)`.

## Algoritmo de render

```ts
function nextPow2(n: number): number {
  return n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n))
}

type Match = {
  id: string  // ex: "R0M0"
  round: number  // 0-based
  index: number  // index dentro da round
  top: number | null  // null = BYE (só no round 0) ou TBD (rounds > 0)
  bottom: number | null
}

function buildBracket(slots: (number | null)[], N: number): Match[][] {
  const pot2 = nextPow2(N)
  const bracketSlots = [...slots, ...Array(pot2 - N).fill(null)]
  const rounds = Math.max(1, Math.log2(pot2))
  const result: Match[][] = []

  // Round 0
  const round0: Match[] = []
  for (let i = 0; i < pot2; i += 2) {
    round0.push({
      id: `R0M${i / 2}`,
      round: 0,
      index: i / 2,
      top: bracketSlots[i] ?? null,
      bottom: bracketSlots[i + 1] ?? null,
    })
  }
  result.push(round0)

  // Round 1..rounds-1: placeholders
  for (let r = 1; r < rounds; r++) {
    const matchesNesta = pot2 / 2 ** (r + 1)
    const round: Match[] = []
    for (let i = 0; i < matchesNesta; i++) {
      round.push({
        id: `R${r}M${i}`,
        round: r,
        index: i,
        top: null,
        bottom: null,
      })
    }
    result.push(round)
  }

  return result
}
```

## Labels semânticos por round

```ts
function roundLabel(matchesNesta: number): string {
  if (matchesNesta === 1) return 'Final'
  if (matchesNesta === 2) return 'Semifinal'
  if (matchesNesta === 4) return 'Quartas'
  if (matchesNesta === 8) return 'Oitavas'
  // matches ≥ 16 → "1ª Rodada", "2ª Rodada"...
  // Round 0 com mais que 8 matches indica torneio grande
  return 'Rodada'  // fallback genérico
}
```

Para o caso `>= 16 matches`: usar `Round.index + 1` é confuso. Decisão: usar fallback `Rodada` simples — em torneios desse porte, a UI vai mostrar muitas colunas e é raro no contexto do projeto (sistema_disputas_chaves só vai até N=77, então pot2 máximo = 128, 7 rounds: 64 → 32 → 16 → 8 → 4 → 2 → 1; rodadas com 64/32/16 viram "Rodada"; demais usam labels semânticos).

Refinar para suporte completo:
```ts
function roundLabel(matchesNesta: number, totalRounds: number, roundIdx: number): string {
  if (matchesNesta === 1) return 'Final'
  if (matchesNesta === 2) return 'Semifinal'
  if (matchesNesta === 4) return 'Quartas'
  if (matchesNesta === 8) return 'Oitavas'
  // Para rounds com 16+ matches, usar ordinal
  return `${roundIdx + 1}ª Rodada`
}
```

## Layout

### Estrutura HTML/JSX

```tsx
<div style={{
  display: 'flex',
  gap: large ? 32 : 16,
  overflowX: 'auto',
  padding: large ? 16 : 8,
}}>
  {rounds.map((roundMatches, r) => (
    <div key={r} style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',  // distribui matches verticalmente
      gap: large ? 16 : 8,
      minWidth: large ? 280 : 200,
    }}>
      <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
        {roundLabel(roundMatches.length, rounds.length, r)}
        {' · '}
        {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
      </div>
      {roundMatches.map(match => (
        <MatchCard key={match.id} match={match} large={large} participantesById={...} campeoesByParticipanteId={...} />
      ))}
    </div>
  ))}
</div>
```

### `MatchCard` (componente local inline)

```tsx
function MatchCard({ match, large, participantesById, campeoesByParticipanteId }) {
  const renderSlot = (pid: number | null, position: 'top' | 'bottom') => {
    // Round 0 + null = BYE; round > 0 + null = TBD
    if (pid === null) {
      const isBye = match.round === 0
      return (
        <span style={{ color: 'var(--t4)', fontStyle: 'italic' }}>
          {isBye ? 'BYE' : `Vencedor M${match.index + 1}`}
        </span>
      )
    }
    const p = participantesById.get(pid)
    const pos = campeoesByParticipanteId?.get(pid)
    if (!p) return <span style={{ color: 'var(--t4)' }}>—</span>
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {pos && <CampeaoBadge posicao={pos} large={large} />}
        <span>{p.nome}{p.subtitulo && <span style={{ fontSize: '0.85em', color: 'var(--t3)', marginLeft: 4 }}>— {p.subtitulo}</span>}</span>
      </span>
    )
  }

  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 12 : 8 }}>
      <div style={{ fontSize: large ? '1.25rem' : '0.95rem', color: 'var(--t1)', padding: '4px 0' }}>
        {renderSlot(match.top, 'top')}
      </div>
      <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
      <div style={{ fontSize: large ? '1.25rem' : '0.95rem', color: 'var(--t1)', padding: '4px 0' }}>
        {renderSlot(match.bottom, 'bottom')}
      </div>
    </div>
  )
}
```

### Vertical alignment (sensação de árvore)

`justifyContent: 'space-around'` em cada coluna faz os matches distribuírem verticalmente. Como round N tem metade dos matches da round N-1, cada match de N fica visualmente no meio de 2 matches de N-1. Não é perfeito (sem conectores), mas dá a impressão de árvore.

Se quiser conectores reais (SVG entre cards), fica pra futura iteração — fora de escopo nesta sub-fase.

## Casos especiais

- **N=1**: pot2=1, rounds=[1 match com top=slots[0], bottom=null]. Round 0 = Final. Renderiza único card com 1 jogador + "BYE". Label = "Final".
- **N=2**: pot2=2, 1 round = "Final". 1 match (slots[0] vs slots[1]).
- **N=3**: pot2=4, 2 rounds. Round 0 = 2 matches (Semifinal): (slots[0],slots[1]) e (slots[2], null=BYE). Round 1 = 1 match (Final).
- **N=8**: pot2=8, 3 rounds = Quartas → Semifinal → Final.

## Reuso e compatibilidade

- Componente continua exportando assinatura idêntica → `EventoInscricoes` e `CongressoStepSorteio` continuam funcionando sem mudança.
- Prop `large` aumenta padding/fonte/gap (Datashow).
- Prop `campeoesByParticipanteId` continua propagada para badge no round 0.

## Release

- `package.json`: `1.16.1` → `1.17.0` (MINOR — mudança visual significativa, não-breaking nos dados).
- `CHANGELOG.md`: bloco `[1.17.0]` com `Changed` (SorteioChaves renderiza bracket em árvore).

## Smoke pós-deploy

1. /eventos → Inscrições → modalidade chaves com 8 inscritos sorteada → resultado mostra 3 colunas (Quartas / Semifinal / Final). Round 0 com 4 matches preenchidos. Round 1+2 com placeholders "Vencedor M1" etc.
2. Modalidade chaves com 5 inscritos → 3 colunas (Quartas/Semifinal/Final), round 0 com 4 matches: 2 deles com 1 BYE cada (5 jogadores + 3 byes = 8 slots).
3. Modalidade chaves com 2 inscritos → 1 coluna (Final), 1 match com 2 jogadores.
4. Modalidade chaves com 16 inscritos → 4 colunas (Oitavas / Quartas / Semifinal / Final). Cabeças (definidos em sistema_disputas_chaves) aparecem nas posições corretas dos pares.
5. Badge de campeão aparece corretamente na round 0 ao lado do nome (se campeão inscrito).
6. Modo Congresso → passo Sorteio com `large=true` → bracket visualmente maior (texto + padding + gap).
7. Rodapé sidebar: `v1.17.0`.

## Risco / efeitos colaterais

- **Sorteios antigos pré-v1.16.0 com `size = pot2` + nulls explícitos no meio**: renderer atualiza para usar `slots.length` ao invés de `size` (já que size pode estar errado ou estar igual a slots.length). Backend sempre dá N = slots.length, mas para retrocompatibilidade com dados velhos, sempre confia em slots.length.
- **N=1 case**: render mínimo (um card BYE) — comportamento OK mas raro.
- **Overflow horizontal**: muitas rodadas (até 7 com pot2=128) podem extrapolar viewport. `overflowX: auto` permite scroll horizontal. No Datashow (large), uma rodada extra pode quebrar o layout. Aceito — operador escolhe modalidades com N≤32 para projeção.
- **Sem conectores SVG**: aparência meio "desconexa" entre colunas. Aceito como MVP.
- **Constraint chaves ≠ grupos**: já garantida pelo service.executar (dispatch por tipo). Sem mudança necessária.
