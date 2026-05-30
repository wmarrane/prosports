# Bracket de Eliminação — Render em Árvore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend-only: reescrever `SorteioChaves.tsx` para renderizar bracket em árvore (colunas horizontais por rodada com placeholders TBD nas rodadas seguintes), em vez da lista flat atual. Bump para `1.17.0`.

**Architecture:** Componente puro no client. Calcula `nextPow2(N)`, faz padding com nulls, gera rodadas via `log2(pot2)`. Cada rodada é uma coluna; cada match é um card com 2 slots. Round 0 = nomes reais (ou BYE); rounds > 0 = placeholders "Vencedor M{n}". Reuso integral das props (`large`, `campeoesByParticipanteId`).

**Tech Stack:** React 18 + TypeScript + tokens R2P. Sem backend, sem deps.

**Spec:** `docs/superpowers/specs/2026-05-30-bracket-eliminacao-design.md`

---

## File Structure

**Frontend — Modify:**
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — reescreve render para bracket em árvore.

**Release:**
- `package.json` (root): `1.16.1` → `1.17.0`.
- `CHANGELOG.md`: bloco `[1.17.0]`.

Sem novos arquivos. Backend não tocado.

---

## Task 1: Reescrever `SorteioChaves.tsx`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioChaves.tsx`

**Contexto:**
- Componente atual recebe `{ resultado: ChavesResultado, participantesById, large?, campeoesByParticipanteId? }`.
- `ChavesResultado` (em `types/sorteio.ts`) = `{ size: number, slots: (number | null)[] }`.
- Backend pode dar `size === slots.length` (≥ v1.16.0) ou `size = pot2` com nulls explícitos (sorteios pré-v1.16.0). Plano confia em `slots.length` para N atual.
- Sub-componente local `MatchCard`: dois slots (top/bottom) com lógica de render condicional (BYE vs TBD vs nome).
- `CampeaoBadge` continua sendo importado e renderizado ao lado do nome quando aplicável.

- [ ] **Step 1: Substituir o arquivo inteiro**

Substituir `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioChaves.tsx` por:

```tsx
import type { ChavesResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  resultado: ChavesResultado
  participantesById: Map<number, Participante>
  large?: boolean
  campeoesByParticipanteId?: Map<number, number>
}

type Match = {
  id: string
  round: number
  index: number
  top: number | null
  bottom: number | null
}

function nextPow2(n: number): number {
  return n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n))
}

function buildBracket(slots: readonly (number | null)[]): Match[][] {
  const N = slots.length
  const pot2 = nextPow2(N)
  const bracketSlots: (number | null)[] = [...slots, ...Array(Math.max(0, pot2 - N)).fill(null)]
  const totalRounds = Math.max(1, Math.log2(pot2))
  const result: Match[][] = []

  // Round 0
  const round0: Match[] = []
  if (pot2 === 1) {
    // Caso degenerado: 1 jogador, "Final" com BYE
    round0.push({ id: 'R0M0', round: 0, index: 0, top: bracketSlots[0] ?? null, bottom: null })
  } else {
    for (let i = 0; i < pot2; i += 2) {
      round0.push({
        id: `R0M${i / 2}`,
        round: 0,
        index: i / 2,
        top: bracketSlots[i] ?? null,
        bottom: bracketSlots[i + 1] ?? null,
      })
    }
  }
  result.push(round0)

  // Rounds 1..totalRounds-1: placeholders TBD
  for (let r = 1; r < totalRounds; r++) {
    const matchesNesta = pot2 / 2 ** (r + 1)
    const round: Match[] = []
    for (let i = 0; i < matchesNesta; i++) {
      round.push({ id: `R${r}M${i}`, round: r, index: i, top: null, bottom: null })
    }
    result.push(round)
  }

  return result
}

function roundLabel(matchesNesta: number, roundIdx: number): string {
  if (matchesNesta === 1) return 'Final'
  if (matchesNesta === 2) return 'Semifinal'
  if (matchesNesta === 4) return 'Quartas'
  if (matchesNesta === 8) return 'Oitavas'
  return `${roundIdx + 1}ª Rodada`
}

type SlotRenderProps = {
  pid: number | null
  isRoundZero: boolean
  matchIndex: number
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}

function SlotRender({ pid, isRoundZero, matchIndex, large, participantesById, campeoesByParticipanteId }: SlotRenderProps) {
  const fontSize = large ? '1.25rem' : '0.95rem'
  if (pid === null) {
    return (
      <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize }}>
        {isRoundZero ? 'BYE' : `Vencedor M${matchIndex + 1}`}
      </span>
    )
  }
  const p = participantesById.get(pid)
  const pos = campeoesByParticipanteId?.get(pid)
  if (!p) {
    return <span style={{ color: 'var(--t4)', fontSize }}>—</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize, color: 'var(--t1)' }}>
      {pos && <CampeaoBadge posicao={pos} large={large} />}
      <span>
        {p.nome}
        {p.subtitulo && (
          <span style={{ fontSize: '0.85em', color: 'var(--t3)', marginLeft: 4 }}>— {p.subtitulo}</span>
        )}
      </span>
    </span>
  )
}

type MatchCardProps = {
  match: Match
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}

function MatchCard({ match, large, participantesById, campeoesByParticipanteId }: MatchCardProps) {
  const isRoundZero = match.round === 0
  return (
    <div
      className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg"
      style={{ padding: large ? 12 : 8 }}
    >
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.top}
          isRoundZero={isRoundZero}
          matchIndex={match.index * 2}
          large={large}
          participantesById={participantesById}
          campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
      <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.bottom}
          isRoundZero={isRoundZero}
          matchIndex={match.index * 2 + 1}
          large={large}
          participantesById={participantesById}
          campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
    </div>
  )
}

export default function SorteioChaves({ resultado, participantesById, large = false, campeoesByParticipanteId }: Props) {
  const rounds = buildBracket(resultado.slots)

  return (
    <div
      style={{
        display: 'flex',
        gap: large ? 32 : 16,
        overflowX: 'auto',
        padding: large ? 16 : 8,
      }}
    >
      {rounds.map((roundMatches, r) => (
        <div
          key={r}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            gap: large ? 16 : 8,
            minWidth: large ? 280 : 200,
            flexShrink: 0,
          }}
        >
          <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
            {roundLabel(roundMatches.length, r)} · {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
          </div>
          {roundMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              large={large}
              participantesById={participantesById}
              campeoesByParticipanteId={campeoesByParticipanteId}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/sorteio-result/SorteioChaves.tsx
git commit -m "feat(sorteios): render SorteioChaves as elimination bracket tree (columns by round)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.16.1"` para `"version": "1.17.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.16.1]`:

```md
## [1.17.0] - 2026-05-30

### Changed
- `SorteioChaves` (modalidades tipo chaves) agora renderiza bracket de eliminação simples em árvore (colunas horizontais por rodada), em vez de lista flat de slots.
- Labels semânticos por rodada: Final / Semifinal / Quartas / Oitavas / "Nª Rodada" para tamanhos maiores.
- Round 0 mostra os pares iniciais (nomes ou BYE quando N não é potência de 2). Rounds seguintes mostram placeholders "Vencedor M{n}".

### Notes
- Sem mudança no backend. Sorteios antigos (formato `size = pot2` com nulls) continuam renderizando — frontend confia em `slots.length` para determinar N atual.
- Badge de campeão do ano anterior continua aparecendo ao lado do nome na 1ª rodada.
- Constraint "modalidade tipo chaves não tem fase de grupos" já era garantida pelo backend (service dispatch por tipo).
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.17.0 — bracket de eliminacao em arvore (SorteioChaves)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI reconstrói só frontend (sem migrations). ~3-4min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: ambos 200.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. Setup: criar/usar modalidade tipo `chaves` com 8 inscritos (regra `sistema_disputas_chaves` para N=8 já existe). Realizar sorteio.
2. /eventos/:id/inscricoes → seção Sorteio → bracket aparece em **3 colunas horizontais**: "Quartas · 4 matches" / "Semifinal · 2 matches" / "Final · 1 match".
3. Round 0 (Quartas) mostra os 4 pares com nomes reais dos inscritos.
4. Round 1 (Semifinal) mostra 2 cards com placeholders "Vencedor M1" / "Vencedor M2" / etc.
5. Round 2 (Final) mostra 1 card com 2 placeholders.
6. Testar com N=5: bracket de 3 rodadas (Quartas / Semifinal / Final). Round 0 com 4 matches: 1 ou mais BYEs explícitos (5 jogadores + 3 byes = 8 slots).
7. Testar com N=2: bracket de 1 rodada só (Final), 1 match com 2 jogadores reais.
8. Testar com N=16: 4 colunas (Oitavas / Quartas / Semifinal / Final).
9. Cabeças (definidos em sistema_disputas_chaves) aparecem nas posições corretas dos pares.
10. Badge de campeão do ano anterior continua aparecendo no nome quando aplicável.
11. Modo Congresso → passo Sorteio → bracket com `large=true` → tipografia maior, padding maior, colunas mais largas (280px).
12. Rodapé sidebar: `v1.17.0`.

- [ ] **Step 4: Reportar**

Se passou, feature fechada.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| `buildBracket` com nextPow2 + padding + log2 rounds | Task 1 (`buildBracket`) |
| Labels semânticos por matches (Final / Semifinal / Quartas / Oitavas / Nª Rodada) | Task 1 (`roundLabel`) |
| Layout flexbox colunas horizontais + scroll horizontal | Task 1 (container `display: flex, overflowX: auto`) |
| MatchCard com 2 slots (top/bottom) e linha divisória | Task 1 (`MatchCard`) |
| BYE em round 0 (slot=null), TBD em rounds > 0 | Task 1 (`SlotRender` com `isRoundZero`) |
| Badge campeão preservado | Task 1 (SlotRender renderiza `<CampeaoBadge>`) |
| Reuso de prop `large` (Datashow) | Task 1 (fontSize, padding, gap, minWidth diferenciados) |
| Backward-compat (slots.length em vez de resultado.size) | Task 1 (`buildBracket(resultado.slots)` usa `slots.length`) |
| Casos especiais N=1, N=2, N=3, N=8 | Task 1 (algoritmo robusto + smoke cases 7,8) |
| Bump 1.17.0 + CHANGELOG | Task 2 |
| Smoke pós-deploy | Task 3 |

Riscos endereçados:
- **Slot.length vs resultado.size**: usa `slots.length` para retrocompat com sorteios antigos.
- **N=1 caso degenerado**: tratado explicitamente em `buildBracket` (1 match com top + null).
- **Overflow horizontal em N grande**: `overflowX: auto` no container.
- **Sem testes vitest**: padrão do projeto — UI puramente apresentação, smoke manual cobre os casos. Se fosse possível, testaria `buildBracket` (função pura) com vitest — mas tá inline no componente para evitar arquivo extra. Tradeoff aceito: lógica é simples e visualmente verificável no smoke.
- **Constraint "chaves ≠ grupos"**: já garantida pelo backend (service dispatch). Sem mudança.
