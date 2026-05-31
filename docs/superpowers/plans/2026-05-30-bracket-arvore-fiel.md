# Bracket Árvore Fiel à Planilha (SVG Conectores) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar render de bracket de chaves como árvore visual fiel à planilha CHAVES CT.xlsx (colunas por rodada, cards de match, conectores SVG entre vencedores e próximas partidas). Preservar regra das cabeças e fallback para sorteios antigos.

**Architecture:** Backend ganha tabela `bracket_chaves_matches(numero_inscrito, matches_graph JSONB)` com grafo completo por N (extraído da planilha). Engine retorna `matchesGraph` no `ChavesResultado`. Frontend novo componente `BracketTree.tsx` renderiza cards de match posicionados em `(coluna_round, índice_vertical)` com SVG overlay para conectores. Backward compat: sem `matchesGraph` → fallback ao render v1.18.1.

**Tech Stack:** Postgres JSONB + Prisma + Node 22 + TypeScript + React 18 + SVG inline. Python (openpyxl) para extração.

**Spec:** `docs/superpowers/specs/2026-05-30-bracket-arvore-fiel-design.md`

---

## File Structure

**Backend — Modify:**
- `backend/prisma/schema.prisma` — add `BracketChavesMatches` model.
- `backend/src/modules/sorteios/engine.ts` — add `MatchesGraph` type, `drawBracket` recebe `matchesGraph` param e retorna.
- `backend/src/modules/sorteios/engine.test.ts` — testes do novo campo no resultado.
- `backend/src/modules/sorteios/sorteios.service.ts` — carrega `bracketChavesMatches` e passa ao engine.
- `backend/src/modules/sorteios/sorteios.service.test.ts` — mock novo prisma call.

**Backend — Create:**
- `backend/prisma/migrations/{ts}_add_bracket_chaves_matches/migration.sql` — table + seed.
- `backend/prisma/seeds/bracket_chaves_matches.sql` — INSERTs JSON.
- `backend/scripts/extract-bracket-graphs.py` — extração one-off.

**Frontend — Modify:**
- `frontend/src/types/sorteio.ts` — `MatchesGraph` type + adicionar `matchesGraph?` em `ChavesResultado`.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — dispatch entre novo BracketTree e legacy.

**Frontend — Create:**
- `frontend/src/components/sorteio-result/BracketTree.tsx` — novo render React + SVG.

**Release:**
- `package.json`: 1.18.1 → 1.19.0.
- `CHANGELOG.md`: bloco `[1.19.0]`.

---

## Task 1: Adicionar model `BracketChavesMatches` + migration

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`

- [ ] **Step 1: Adicionar model ao schema**

Inserir no FIM do arquivo (após `BracketChavesByes`):

```prisma
model BracketChavesMatches {
  numero_inscrito Int  @id
  matches_graph   Json
  @@map("bracket_chaves_matches")
}
```

- [ ] **Step 2: Gerar migration (NÃO aplicar)**

De `backend/`:
```
npx prisma migrate dev --name add_bracket_chaves_matches --create-only
```

Expected: cria `backend/prisma/migrations/{ts}_add_bracket_chaves_matches/migration.sql` com `CREATE TABLE "bracket_chaves_matches" ("numero_inscrito" INTEGER NOT NULL PRIMARY KEY, "matches_graph" JSONB NOT NULL)`. NÃO aplicar (seed será apendado na Task 5).

- [ ] **Step 3: Verificar migration.sql**

Abrir e confirmar `CREATE TABLE` com tipo `JSONB` para `matches_graph`.

- [ ] **Step 4: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(sorteios): add BracketChavesMatches prisma model + migration" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Script de extração — N=6..22 via tabela explícita

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\scripts\extract-bracket-graphs.py`

Contexto:
- Planilha em `personaladmin/CHAVES CT.xlsx`. Para N=6..22 cada aba tem uma tabela com colunas `id | Chave | posição | Rodada | Primeira Rodada | Segunda Rodada | isbye`.
- Esta task implementa apenas a leitura dessa tabela e gera grafo parcial para N=6..22. Task 3 estende com parser visual.
- Formato de saída do grafo: `{ "matches": [...], "final": "J{x}", "thirdPlace": "J{y}"|null }`. Cada match: `{ "id": "J{n}", "round": int, "top": "P{n}"|"V:J{n}", "bottom": "P{n}"|"V:J{n}" }`.

- [ ] **Step 1: Criar o script base com extração explícita**

Criar arquivo:

```python
#!/usr/bin/env python3
"""
Extract full match graph per N from personaladmin/CHAVES CT.xlsx.

Phase 1 (this script): explicit table for N=6..22.
Phase 2 (next task): visual parser for N=2..5 and N=23..77 + validation.

Output: backend/prisma/seeds/bracket_chaves_matches.sql with INSERT...ON CONFLICT
statements per N. Graph format:
  { "matches": [{ "id":"J1", "round":1, "top":"P2", "bottom":"P3" }, ...],
    "final": "J11", "thirdPlace": "J12"|null }

Usage:
  cd backend && python scripts/extract-bracket-graphs.py
"""
from openpyxl import load_workbook
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / 'personaladmin' / 'CHAVES CT.xlsx'
OUT  = ROOT / 'backend' / 'prisma' / 'seeds' / 'bracket_chaves_matches.sql'

def parse_cell_ref(value):
    """Normalize cell value to graph reference.

    - Integer or numeric string => 'P{n}' (position).
    - 'Venc.J{x}' or 'Venc.Jx' => 'V:J{x}'.
    - 'Perd.J{x}' => 'L:J{x}'.
    - None/blank/'null'/'0' => None (placeholder, not yet resolved).
    """
    if value is None: return None
    s = str(value).strip()
    if s in ('', '0', 'null', '#REF!'): return None
    if re.fullmatch(r'\d+', s):
        return f'P{s}'
    m = re.fullmatch(r'Venc\.J(\d+)', s, re.IGNORECASE)
    if m: return f'V:J{m.group(1)}'
    m = re.fullmatch(r'Perd\.J(\d+)', s, re.IGNORECASE)
    if m: return f'L:J{m.group(1)}'
    return None

def find_matches_list(ws):
    """Locate the matches list (rows with 'J | n | top | x | bottom'). Returns
    list of (match_id, top_raw, bottom_raw).
    """
    # Scan for column where 'Jogo' header is, then matches follow below as
    # 'J | n | top | x | bottom'.
    jogo_row = jogo_col = None
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            if ws.cell(row=r, column=c).value == 'Jogo':
                jogo_row, jogo_col = r, c
                break
        if jogo_row: break
    if not jogo_row: return []
    out = []
    for r in range(jogo_row + 1, ws.max_row + 1):
        prefix = ws.cell(row=r, column=jogo_col).value
        if prefix != 'J': break  # end of matches block
        n = ws.cell(row=r, column=jogo_col + 1).value
        top = ws.cell(row=r, column=jogo_col + 2).value
        bot = ws.cell(row=r, column=jogo_col + 4).value
        if n is None: continue
        out.append((f'J{int(n)}', top, bot))
    return out

def derive_rounds(matches, N):
    """Assign 'round' to each match based on dependencies.

    Round 1: both top/bottom resolve to 'P{n}'.
    Round k: max(round(top_dep), round(bottom_dep)) + 1.
    """
    rounds = {}
    pending = list(matches)
    while pending:
        progress = False
        next_pending = []
        for m in pending:
            mid = m['id']
            deps = []
            for ref in (m['top'], m['bottom']):
                if ref and ref.startswith('V:'):
                    deps.append(ref[2:])  # 'J{x}'
                elif ref and ref.startswith('L:'):
                    deps.append(ref[2:])
            if not deps:
                rounds[mid] = 1
                progress = True
            elif all(d in rounds for d in deps):
                rounds[mid] = max(rounds[d] for d in deps) + 1
                progress = True
            else:
                next_pending.append(m)
        if not progress:
            raise RuntimeError(f'Cannot derive rounds for: {[m["id"] for m in next_pending]}')
        pending = next_pending
    for m in matches:
        m['round'] = rounds[m['id']]
    return matches

def explicit_graph(ws, N):
    """Extract graph from explicit matches list. Returns dict or None."""
    raw = find_matches_list(ws)
    if not raw: return None
    matches = []
    third_place = None
    for mid, top_raw, bot_raw in raw:
        top = parse_cell_ref(top_raw)
        bot = parse_cell_ref(bot_raw)
        if top is None or bot is None:
            return None  # incomplete data
        # Detect 3rd place: at least one ref is L:Jx
        if top.startswith('L:') or bot.startswith('L:'):
            third_place = mid
        matches.append({'id': mid, 'top': top, 'bottom': bot})
    derive_rounds(matches, N)
    max_round = max(m['round'] for m in matches if m['id'] != third_place)
    final_match = next(m['id'] for m in matches if m['round'] == max_round and m['id'] != third_place)
    return {
        'matches': matches,
        'final': final_match,
        'thirdPlace': third_place,
    }

def main():
    wb = load_workbook(XLSX, data_only=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        '-- Auto-generated by backend/scripts/extract-bracket-graphs.py',
        '-- DO NOT EDIT MANUALLY. To regenerate: cd backend && python scripts/extract-bracket-graphs.py',
        '',
    ]
    missing = []
    for n in range(2, 78):
        sn = f'{n:02d}'
        if sn not in wb.sheetnames: continue
        ws = wb[sn]
        g = explicit_graph(ws, n)
        if g is None:
            missing.append(n)
            lines.append(f'-- N={n}: PENDING (visual parser not yet implemented; will add in task 3)')
            lines.append('')
            continue
        graph_json = json.dumps(g, separators=(',', ':'))
        # Escape single quotes for Postgres literal
        escaped = graph_json.replace("'", "''")
        lines.append(f"-- N={n}: EXPLICIT")
        lines.append(
            f"INSERT INTO bracket_chaves_matches (numero_inscrito, matches_graph) "
            f"VALUES ({n}, '{escaped}'::jsonb) "
            f"ON CONFLICT (numero_inscrito) DO UPDATE SET matches_graph = EXCLUDED.matches_graph;"
        )
        lines.append('')

    OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {OUT}')
    print(f'EXPLICIT: {76 - len(missing)} N values')
    print(f'PENDING (visual parser): {len(missing)} N values: {missing}')

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Rodar e inspecionar saída parcial**

De `backend/`:
```
python scripts/extract-bracket-graphs.py
```

Expected stdout:
- `EXPLICIT: 17 N values` (N=6..22)
- `PENDING (visual parser): 59 N values: [2, 3, 4, 5, 23, 24, ..., 77]`

Abrir `backend/prisma/seeds/bracket_chaves_matches.sql` e verificar que:
- N=6..22 têm INSERT com JSON resolvendo `P{n}` e `V:J{x}`.
- N=12 INSERT contém `"final":"J11"` e `"thirdPlace":"J12"` (12 matches total).

- [ ] **Step 3: Smoke check N=12 manualmente**

Procurar a linha do N=12 no SQL e validar:
- 4 matches em round 1 (J1-J4) com top/bottom = P{n}
- 4 matches em round 2 (J5-J8) com BYE+Venc
- 2 matches em round 3 (J9, J10) com Venc+Venc
- 1 match round 4 (J11) Final
- 1 match com Perd (3rd place)

Se algum não bater → bug no extractor, investigar.

- [ ] **Step 4: Commit do script + seed parcial**

```
git add backend/scripts/extract-bracket-graphs.py backend/prisma/seeds/bracket_chaves_matches.sql
git commit -m "feat(sorteios): extract-bracket-graphs.py — explicit data for N=6..22" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Estender script — parser visual para N=2..5 e N=23..77

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\scripts\extract-bracket-graphs.py`

Contexto:
- Para os 59 N restantes, a planilha tem apenas o bracket visual à esquerda:
  - Coluna A: números 1..N em linhas específicas (posições).
  - Colunas C, E, G, I, K, ...: labels `j1, j2, ...` na linha do PONTO MÉDIO entre os dois entries que aquele match liga.
  - Cada coluna de label = uma round (C=R1, E=R2, etc.).
- Algoritmo: para cada label `jX` na coluna `C_k`, achar os 2 entries pareados (positions ou matches da round anterior) por proximidade vertical.

- [ ] **Step 1: Adicionar parser visual e validação**

Adicionar funções `visual_graph` e `validate_parser` ao script (antes do `main()`):

```python
def find_positions(ws, N):
    """Return [(pos_int, row_int)] for positions 1..N found in column A."""
    found = {}
    for r in range(1, ws.max_row + 1):
        v = ws.cell(row=r, column=1).value
        if isinstance(v, int) and 1 <= v <= N and v not in found:
            found[v] = r
    return sorted(found.items(), key=lambda x: x[1])

def find_round_labels(ws):
    """Return [(round_idx, match_id_str, row, col)] sorted by col.

    Match label is 'j1', 'j2', etc. Round index = unique-column-order
    (leftmost = 1, next = 2, ...). Skip cols 1, 2 (position area).
    """
    raw = []
    for r in range(1, ws.max_row + 1):
        for c in range(3, ws.max_column + 1):
            v = ws.cell(row=r, column=c).value
            if v is None: continue
            m = re.fullmatch(r'[jJ](\d+)', str(v).strip())
            if m:
                raw.append((c, r, f'J{m.group(1)}'))
    raw.sort()  # by col, then row
    cols_sorted = sorted({c for c, _, _ in raw})
    col_to_round = {c: i + 1 for i, c in enumerate(cols_sorted)}
    return [(col_to_round[c], mid, r, c) for c, r, mid in raw]

def visual_graph(ws, N):
    """Parse visual bracket and build match graph. Returns dict.

    Raises if structure is ambiguous (mismatched counts, unresolvable refs).
    """
    positions = find_positions(ws, N)
    if len(positions) != N:
        raise RuntimeError(f'N={N}: found {len(positions)} positions, expected {N}')
    pos_row = {p: r for p, r in positions}  # pos_int -> row
    row_pos = {r: p for p, r in positions}

    labels = find_round_labels(ws)
    # Group labels by round.
    by_round = {}
    for rd, mid, r, c in labels:
        by_round.setdefault(rd, []).append((mid, r, c))
    # For each round, sort labels by row (top-to-bottom).
    for rd in by_round:
        by_round[rd].sort(key=lambda x: x[1])

    # "Output point" for each entity (position or match):
    #   position: (col=1 implicit, row=pos_row[p])
    #   match Jx: (col=label_col, row=label_row)
    output_row = {}  # ref -> row (for matching pairs)
    for p, r in positions:
        output_row[f'P{p}'] = r
    for rd, mid, r, c in labels:
        output_row[f'V:{mid}'] = r  # match's "output" is at its label row

    matches = []
    third_place = None
    for rd in sorted(by_round):
        for mid, r, c in by_round[rd]:
            # Find pair: closest entity ABOVE and BELOW this label.
            # Candidates: positions (col A) for R1; matches in prev round col + positions (for BYEs) for R>1.
            if rd == 1:
                # Top: nearest position with row < r. Bottom: row > r.
                tops = [(pr, p) for p, pr in positions if pr < r]
                bots = [(pr, p) for p, pr in positions if pr > r]
                if not tops or not bots:
                    raise RuntimeError(f'R1 label {mid} at row {r}: no flanking positions')
                top_pos = max(tops)[1]
                bot_pos = min(bots)[1]
                matches.append({
                    'id': mid,
                    'round': 1,
                    'top': f'P{top_pos}',
                    'bottom': f'P{bot_pos}',
                })
            else:
                # Candidates: prev-round labels + ALL positions (BYEs may flank).
                prev_col = sorted({c2 for c2 in (lbl[2] for r2 in by_round for lbl in by_round[r2]) if c2 < c})[-1] if any(lbl[2] < c for r2 in by_round for lbl in by_round[r2]) else 1
                # Build list of entities visible to this label, sorted by row.
                entities = []
                # Add prev-round matches
                for prev_mid, prev_r, prev_c in by_round.get(rd - 1, []):
                    entities.append((prev_r, f'V:{prev_mid}'))
                # Add positions (BYEs and others — but only positions that aren't already "consumed" by R1 will end up here as BYEs visually)
                for p, pr in positions:
                    entities.append((pr, f'P{p}'))
                entities.sort()
                # Find closest above (max row < r) and below (min row > r)
                above = [e for er, e in entities if er < r]
                below = [e for er, e in entities if er > r]
                if not above or not below:
                    raise RuntimeError(f'R{rd} label {mid} at row {r}: no flanking entities')
                top_ref = above[-1]
                bot_ref = below[0]
                matches.append({
                    'id': mid,
                    'round': rd,
                    'top': top_ref,
                    'bottom': bot_ref,
                })

    # Final = highest round (single match).
    max_rd = max(m['round'] for m in matches)
    finals = [m for m in matches if m['round'] == max_rd]
    if len(finals) != 1:
        # 3rd place may be in same round as final. Heuristic: final has higher
        # "depth" of V: refs; thirdPlace has Perd. But Perd doesn't appear in
        # visual (only resolved at runtime). For visual parser, assume the
        # match whose label is positioned LATER (lower row) is 3rd place.
        finals.sort(key=lambda m: next((r for mid, r, c in labels if mid == m['id']), 0))
        third_place = finals[-1]['id']
        final_match = finals[0]['id']
    else:
        final_match = finals[0]['id']

    return {
        'matches': matches,
        'final': final_match,
        'thirdPlace': third_place,
    }

def validate_parser(wb):
    """For each N=6..22 where explicit data exists, compare visual parser
    output. Returns list of mismatches (empty = OK).
    """
    mismatches = []
    for n in range(6, 23):
        sn = f'{n:02d}'
        if sn not in wb.sheetnames: continue
        ws = wb[sn]
        exp = explicit_graph(ws, n)
        try:
            vis = visual_graph(ws, n)
        except Exception as e:
            mismatches.append((n, f'visual parser raised: {e}'))
            continue
        # Compare structure (id, round, top, bottom).
        # Note: visual may have extra/different match ordering. Compare as set.
        exp_set = {(m['id'], m['round'], m['top'], m['bottom']) for m in exp['matches']}
        vis_set = {(m['id'], m['round'], m['top'], m['bottom']) for m in vis['matches']}
        if exp_set != vis_set:
            only_exp = exp_set - vis_set
            only_vis = vis_set - exp_set
            mismatches.append((n, f'matches differ. only_explicit={only_exp} only_visual={only_vis}'))
    return mismatches
```

- [ ] **Step 2: Atualizar `main()` para usar visual parser nos casos sem dados explícitos + rodar validação**

Substituir o `main()` por:

```python
def main():
    wb = load_workbook(XLSX, data_only=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    # Validate visual parser against explicit data
    print('Validating visual parser against explicit data (N=6..22)...')
    mismatches = validate_parser(wb)
    if mismatches:
        print('VALIDATION FAILED:')
        for n, msg in mismatches:
            print(f'  N={n}: {msg}')
        raise SystemExit(1)
    print('  OK — visual parser matches explicit data for all 17 sheets')

    lines = [
        '-- Auto-generated by backend/scripts/extract-bracket-graphs.py',
        '-- DO NOT EDIT MANUALLY. To regenerate: cd backend && python scripts/extract-bracket-graphs.py',
        '',
    ]
    explicit_count = visual_count = 0
    for n in range(2, 78):
        sn = f'{n:02d}'
        if sn not in wb.sheetnames: continue
        ws = wb[sn]
        g = explicit_graph(ws, n)
        if g is not None:
            source = 'EXPLICIT'
            explicit_count += 1
        else:
            try:
                g = visual_graph(ws, n)
                source = 'VISUAL'
                visual_count += 1
            except Exception as e:
                print(f'WARN N={n}: visual parser failed: {e}')
                lines.append(f'-- N={n}: SKIPPED ({e})')
                lines.append('')
                continue
        graph_json = json.dumps(g, separators=(',', ':'))
        escaped = graph_json.replace("'", "''")
        lines.append(f'-- N={n}: {source}')
        lines.append(
            f"INSERT INTO bracket_chaves_matches (numero_inscrito, matches_graph) "
            f"VALUES ({n}, '{escaped}'::jsonb) "
            f"ON CONFLICT (numero_inscrito) DO UPDATE SET matches_graph = EXCLUDED.matches_graph;"
        )
        lines.append('')

    OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {OUT}')
    print(f'EXPLICIT: {explicit_count} N values')
    print(f'VISUAL: {visual_count} N values')

if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Rodar — validação deve passar**

```
cd backend && python scripts/extract-bracket-graphs.py
```

Expected:
- `Validating visual parser against explicit data (N=6..22)... OK — visual parser matches explicit data for all 17 sheets`
- `EXPLICIT: 17 N values`
- `VISUAL: 59 N values`

Se validação falhar: imprime mismatches. Investigar — pode ser bug no algoritmo de pareamento ou casos especiais (N=2 que tem só 1 match, etc.).

**Se validação falhar para algum N específico** (ex.: N=9 ou N=20 onde estrutura é asimétrica e o algoritmo "closest above/below" pode confundir BYE com matches), adicionar lógica especial:
- Para R≥2, prefer matches da round R-1 over BYE positions quando ambos estão à mesma distância vertical.
- Ajustar `entities.sort()` ou critério de tiebreak.

- [ ] **Step 4: Inspecionar a seed gerada**

Verificar que `backend/prisma/seeds/bracket_chaves_matches.sql` tem 76 INSERTs (não SKIPPED). Spot check N=20 (asimétrico) e N=77 (maior).

- [ ] **Step 5: Commit**

```
git add backend/scripts/extract-bracket-graphs.py backend/prisma/seeds/bracket_chaves_matches.sql
git commit -m "feat(sorteios): visual parser for bracket graphs N=2..5, 23..77 + validation" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Apender seed na migration + aplicar

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\migrations\{ts}_add_bracket_chaves_matches\migration.sql`

- [ ] **Step 1: Apender o seed à migration**

PowerShell (substituir {ts} pelo timestamp real):
```powershell
Add-Content -Path "backend\prisma\migrations\{ts}_add_bracket_chaves_matches\migration.sql" -Value "`n" -Value (Get-Content "backend\prisma\seeds\bracket_chaves_matches.sql" -Raw)
```

Ou via copy-paste manual: ler `backend/prisma/seeds/bracket_chaves_matches.sql` e apender no fim de `migration.sql` (após blank line).

- [ ] **Step 2: Aplicar migration**

```
cd backend && npx prisma migrate dev
```

Expected: aplica sem erros.

- [ ] **Step 3: Smoke check DB**

```
ssh wagner@192.168.56.113 "docker run --rm postgres:16-alpine psql 'postgresql://prosports:erp0192@192.168.56.108:5432/newprosports' -c \"SELECT numero_inscrito, jsonb_array_length(matches_graph->'matches') AS n_matches FROM bracket_chaves_matches WHERE numero_inscrito IN (2, 6, 12, 20, 77) ORDER BY numero_inscrito;\""
```

Expected:
```
 numero_inscrito | n_matches 
-----------------+-----------
               2 |         1
               6 |         5
              12 |        12
              20 |        20
              77 |       ~76 (or close)
```

Validar que linha do N=12 tem 12 matches (incluindo Final + 3rd).

- [ ] **Step 4: Commit migration**

```
git add backend/prisma/migrations/
git commit -m "feat(sorteios): seed bracket_chaves_matches in migration (idempotent)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Engine + Service — incluir `matchesGraph` no resultado

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\engine.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\engine.test.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\sorteios.service.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\sorteios.service.test.ts`

Contexto:
- Engine `drawBracket` assinatura atual: `(participantes, regra, regraBracket, seed, campeoesPids)`.
- Adicionar 4º param `matchesGraph: MatchesGraph` antes do seed. Novo retorno tem `matchesGraph` field.
- Service `executar` (caso `chaves`) carrega 3 tabelas via Promise.all (já carrega 2: sistemaDisputasChaves, bracketChavesByes; adicionar bracketChavesMatches).

- [ ] **Step 1: Escrever teste failing no engine.test.ts**

Adicionar este describe block após o existing `describe('drawBracket — com regraBracket (v1.18.0)')`:

```ts
describe('drawBracket — com matchesGraph (v1.19.0)', () => {
  const regraChavesN6 = {
    numero_inscrito: 6,
    posicao_primeiro_cabeca: 1,
    posicao_segundo_cabeca: 6,
    posicao_terceiro_cabeca: 4,
    posicao_quarto_cabeca: 3,
  }
  const regraBracketN6 = { numero_inscrito: 6, posicoes_bye: [1, 6] }
  const matchesGraphN6 = {
    matches: [
      { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
      { id: 'J2', round: 1, top: 'P4', bottom: 'P5' },
      { id: 'J3', round: 2, top: 'P1', bottom: 'V:J1' },
      { id: 'J4', round: 2, top: 'V:J2', bottom: 'P6' },
      { id: 'J5', round: 3, top: 'V:J3', bottom: 'V:J4' },
    ],
    final: 'J5',
    thirdPlace: null,
  }

  it('retorna matchesGraph no resultado', () => {
    const pids = [101, 102, 103, 104, 105, 106]
    const r = drawBracket(pids, regraChavesN6, regraBracketN6, matchesGraphN6, 'seed-x', [])
    expect(r.matchesGraph).toEqual(matchesGraphN6)
  })
})
```

- [ ] **Step 2: Rodar — deve falhar (drawBracket não aceita 4º param)**

```
cd backend && npx vitest run src/modules/sorteios/engine.test.ts --reporter=basic
```

- [ ] **Step 3: Atualizar engine.ts**

Adicionar tipo `MatchesGraph` no topo dos types e atualizar `drawBracket`:

```ts
export type MatchRef = string  // 'P{n}' | 'V:J{x}' | 'L:J{x}'

export type MatchesGraph = {
  matches: Array<{
    id: string
    round: number
    top: MatchRef
    bottom: MatchRef
  }>
  final: string
  thirdPlace: string | null
}

export function drawBracket(
  participantes: number[],
  regra: RegraChaves,
  regraBracket: RegraBracket,
  matchesGraph: MatchesGraph,    // NOVO 4º param
  seed: string,
  campeoesPids: number[] = [],
): { size: number; slots: (number | null)[]; byePositions: number[]; matchesGraph: MatchesGraph } {
  // ... lógica existente (cabeças + shuffle) mantida sem mudança ...
  const N = participantes.length
  const slots: (number | null)[] = new Array(N).fill(null)

  const cabecasPos = [
    regra.posicao_primeiro_cabeca,
    regra.posicao_segundo_cabeca,
    regra.posicao_terceiro_cabeca,
    regra.posicao_quarto_cabeca,
  ].filter(p => p > 0)

  const usedPids = new Set<number>()
  for (let i = 0; i < cabecasPos.length && i < campeoesPids.length; i++) {
    const pid = campeoesPids[i]
    if (cabecasPos[i] >= 1 && cabecasPos[i] <= N) {
      slots[cabecasPos[i] - 1] = pid
      usedPids.add(pid)
    }
  }

  const restantes = participantes.filter(p => !usedPids.has(p))
  const shuffled = shuffleSeeded(restantes, seed)  // use existing helper

  let idx = 0
  for (let i = 0; i < N; i++) {
    if (slots[i] === null && idx < shuffled.length) {
      slots[i] = shuffled[idx++]
    }
  }

  const byePositions = [...regraBracket.posicoes_bye].sort((a, b) => a - b)
  return { size: N, slots, byePositions, matchesGraph }
}
```

NOTA: substituir `shuffleSeeded` pelo nome correto do helper se diferir.

- [ ] **Step 4: Atualizar testes legados de `drawBracket`**

Grep por `drawBracket(` em `engine.test.ts`. Para cada chamada com 5 args (post-Task 5 do plano anterior), inserir `matchesGraph` como 4º argumento com valor `{ matches: [], final: '', thirdPlace: null }` (placeholder OK — testes legados não dependem de matchesGraph).

Exemplo:
```ts
// ANTES
drawBracket(pids, regraChavesN6, regraBracketN6, 'seed', campeoes)
// DEPOIS
drawBracket(pids, regraChavesN6, regraBracketN6, { matches: [], final: '', thirdPlace: null }, 'seed', campeoes)
```

- [ ] **Step 5: Rodar testes do engine**

```
npx vitest run src/modules/sorteios/engine.test.ts --reporter=basic
```

Esperado: todos passam.

- [ ] **Step 6: Adicionar mock `bracketChavesMatches` no sorteios.service.test.ts**

No `vi.mock('../../lib/prisma'...)` no topo, adicionar:
```ts
bracketChavesMatches: {
  findUnique: vi.fn(),
},
```

No `beforeEach`, adicionar default mock:
```ts
mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue({
  numero_inscrito: 5,
  matches_graph: { matches: [], final: '', thirdPlace: null },
})
```

Adicionar teste failing:
```ts
it('executar chaves lança 400 quando bracket_chaves_matches ausente', async () => {
  mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
  mockPrisma.modalidade.findUnique.mockResolvedValue({
    id: 1, competicao_id: 10,
    tipo_modalidade: { tipo: 'chaves' },
  })
  mockPrisma.inscricao.findMany.mockResolvedValue([
    { participante_id: 100 }, { participante_id: 200 },
  ])
  mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
    numero_inscrito: 2, posicao_primeiro_cabeca: 1,
    posicao_segundo_cabeca: 2, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0,
  })
  mockPrisma.bracketChavesByes.findUnique.mockResolvedValue({ numero_inscrito: 2, posicoes_bye: [] })
  mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue(null)

  await expect(service.executar({ evento_id: 1, modalidade_id: 1 })).rejects.toMatchObject({
    status: 400,
    message: expect.stringContaining('grafo de matches'),
  })
})
```

- [ ] **Step 7: Atualizar service.ts**

No `if (tipo === 'chaves')` branch, expandir o Promise.all para 3 lookups e adicionar guard:

```ts
} else if (tipo === 'chaves') {
  const [regra, regraBracket, regraMatches] = await Promise.all([
    prisma.sistemaDisputasChaves.findFirst({
      where: { numero_inscrito: pids.length },
    }),
    prisma.bracketChavesByes.findUnique({
      where: { numero_inscrito: pids.length },
    }),
    prisma.bracketChavesMatches.findUnique({
      where: { numero_inscrito: pids.length },
    }),
  ])
  if (!regra) {
    throw Object.assign(
      new Error(`Não há regra de chaveamento para ${pids.length} inscritos. Cadastre em Administração.`),
      { status: 400 },
    )
  }
  if (!regraBracket) {
    throw Object.assign(
      new Error(`Não há estrutura de bracket cadastrada para ${pids.length} inscritos. Cadastre em Administração.`),
      { status: 400 },
    )
  }
  if (!regraMatches) {
    throw Object.assign(
      new Error(`Não há grafo de matches cadastrado para ${pids.length} inscritos. Cadastre em Administração.`),
      { status: 400 },
    )
  }
  resultado = engine.drawBracket(
    pids,
    regra,
    regraBracket,
    regraMatches.matches_graph as any,
    seed,
    campeoesPidsInscritos,
  )
}
```

- [ ] **Step 8: Rodar testes do service**

```
npx vitest run src/modules/sorteios/sorteios.service.test.ts --reporter=basic
```

- [ ] **Step 9: Rodar suite completa**

```
npx vitest run --reporter=basic
```

Esperado: tudo verde.

- [ ] **Step 10: tsc**

```
npx tsc --noEmit
```

- [ ] **Step 11: Commit**

```
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.service.test.ts
git commit -m "feat(sorteios): engine + service incluem matchesGraph no resultado (v1.19.0)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend types + `BracketTree.tsx` (layout + cards, sem conectores ainda)

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\sorteio.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\BracketTree.tsx`

- [ ] **Step 1: Atualizar tipo em types/sorteio.ts**

Adicionar:
```ts
export type MatchesGraph = {
  matches: Array<{
    id: string
    round: number
    top: string   // 'P{n}' | 'V:J{x}' | 'L:J{x}'
    bottom: string
  }>
  final: string
  thirdPlace: string | null
}

export type ChavesResultado = {
  size: number
  slots: (number | null)[]
  byePositions?: number[]
  matchesGraph?: MatchesGraph   // NOVO
}
```

- [ ] **Step 2: Criar BracketTree.tsx com layout + cards (sem conectores SVG ainda)**

Criar arquivo com:

```tsx
import { useMemo } from 'react'
import type { MatchesGraph } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  matchesGraph: MatchesGraph
  slots: (number | null)[]
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
  large?: boolean
}

type MatchLayout = {
  id: string
  round: number
  top: string
  bottom: string
  x: number       // column position (px)
  y: number       // vertical midpoint (px)
  isFinal: boolean
  isThirdPlace: boolean
}

const CARD_WIDTH = 200
const CARD_HEIGHT = 64
const COL_GAP = 80
const ROW_GAP = 24
const POS_ROW_HEIGHT = CARD_HEIGHT + ROW_GAP

function computeLayout(graph: MatchesGraph, N: number): { matches: MatchLayout[]; width: number; height: number } {
  // Step 1: vertical position per source. Positions P1..PN evenly spaced.
  const posY: Record<string, number> = {}
  for (let p = 1; p <= N; p++) {
    posY[`P${p}`] = (p - 0.5) * POS_ROW_HEIGHT
  }

  // Step 2: order matches by round (so we resolve deps before consumers).
  const matchesSorted = [...graph.matches].sort((a, b) => a.round - b.round)
  const matchById: Record<string, MatchLayout> = {}

  for (const m of matchesSorted) {
    const topY = posY[m.top] ?? matchById[m.top.slice(2)]?.y ?? 0
    const botY = posY[m.bottom] ?? matchById[m.bottom.slice(2)]?.y ?? 0
    // Resolve V:Jx → matchById[Jx].y
    const resolveY = (ref: string): number => {
      if (ref.startsWith('P')) return posY[ref] ?? 0
      const id = ref.slice(2)  // strip 'V:' or 'L:'
      return matchById[id]?.y ?? 0
    }
    const y = (resolveY(m.top) + resolveY(m.bottom)) / 2
    const x = (m.round - 1) * (CARD_WIDTH + COL_GAP)
    const isFinal = m.id === graph.final
    const isThirdPlace = m.id === graph.thirdPlace
    matchById[m.id] = {
      id: m.id, round: m.round, top: m.top, bottom: m.bottom,
      x, y, isFinal, isThirdPlace,
    }
  }

  const width = (Math.max(...matchesSorted.map(m => m.round)) - 1) * (CARD_WIDTH + COL_GAP) + CARD_WIDTH
  const height = Math.max(N * POS_ROW_HEIGHT, ...Object.values(matchById).map(m => m.y + CARD_HEIGHT))
  return { matches: Object.values(matchById), width, height }
}

function renderSlot(
  ref: string,
  slots: (number | null)[],
  participantesById: Map<number, Participante>,
  campeoesByParticipanteId: Map<number, number> | undefined,
  large: boolean,
): React.ReactNode {
  const fontSize = large ? '1rem' : '0.85rem'
  if (ref.startsWith('P')) {
    const pos = parseInt(ref.slice(1), 10)
    const pid = slots[pos - 1] ?? null
    if (pid === null) return <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize }}>BYE</span>
    const p = participantesById.get(pid)
    const cp = campeoesByParticipanteId?.get(pid)
    if (!p) return <span style={{ color: 'var(--t4)', fontSize }}>—</span>
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize, color: 'var(--t1)' }}>
        {cp && <CampeaoBadge posicao={cp} large={false} />}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
      </span>
    )
  }
  if (ref.startsWith('V:')) {
    return <span style={{ color: 'var(--t3)', fontStyle: 'italic', fontSize }}>Vencedor {ref.slice(2)}</span>
  }
  if (ref.startsWith('L:')) {
    return <span style={{ color: 'var(--t3)', fontStyle: 'italic', fontSize }}>Perdedor {ref.slice(2)}</span>
  }
  return null
}

export default function BracketTree({ matchesGraph, slots, participantesById, campeoesByParticipanteId, large = false }: Props) {
  const layout = useMemo(() => computeLayout(matchesGraph, slots.length), [matchesGraph, slots.length])

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', padding: 16, position: 'relative' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height, minWidth: '100%' }}>
        {layout.matches.map(m => (
          <div
            key={m.id}
            className={`bg-[var(--card-bg-2)] border rounded-lg ${m.isFinal ? 'border-amber-500' : 'border-[var(--card-border)]'}`}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              padding: 6,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {m.isFinal && (
              <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                🏆 {m.isThirdPlace ? '3º lugar' : 'Final'}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: 4 }}>
              {renderSlot(m.top, slots, participantesById, campeoesByParticipanteId, large)}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 4 }}>
              {renderSlot(m.bottom, slots, participantesById, campeoesByParticipanteId, large)}
            </div>
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: tsc check**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean (componente não importado ainda, mas tipos válidos).

- [ ] **Step 4: Commit**

```
git add frontend/src/types/sorteio.ts frontend/src/components/sorteio-result/BracketTree.tsx
git commit -m "feat(sorteios): BracketTree component — cards posicionados (sem conectores)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — adicionar SVG conectores no BracketTree

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\BracketTree.tsx`

- [ ] **Step 1: Adicionar lógica de conectores**

Modificar o `BracketTree` para incluir SVG overlay. Substituir o `return` por:

```tsx
  // Compute connectors: for each match input that references V:Jx or L:Jx,
  // draw L-shape from source match's right edge to destination input edge.
  type Connector = { d: string; key: string }
  const matchMap: Record<string, MatchLayout> = {}
  for (const m of layout.matches) matchMap[m.id] = m

  const connectors: Connector[] = []
  for (const m of layout.matches) {
    for (const [slot, ref] of [['top', m.top], ['bottom', m.bottom]] as const) {
      if (!ref.startsWith('V:') && !ref.startsWith('L:')) continue
      const srcId = ref.slice(2)
      const src = matchMap[srcId]
      if (!src) continue
      const x1 = src.x + CARD_WIDTH
      const y1 = src.y
      const x2 = m.x
      const y2 = m.y + (slot === 'top' ? -CARD_HEIGHT / 4 : CARD_HEIGHT / 4)
      // Midpoint vertical line.
      const xm = (x1 + x2) / 2
      const d = `M ${x1} ${y1} L ${xm} ${y1} L ${xm} ${y2} L ${x2} ${y2}`
      connectors.push({ d, key: `${srcId}-${m.id}-${slot}` })
    }
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', padding: 16, position: 'relative' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height, minWidth: '100%' }}>
        <svg
          style={{ position: 'absolute', inset: 0, width: layout.width, height: layout.height, pointerEvents: 'none' }}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          {connectors.map(c => (
            <path key={c.key} d={c.d} stroke="var(--card-border)" strokeWidth={1.5} fill="none" />
          ))}
        </svg>
        {layout.matches.map(m => (
          <div
            key={m.id}
            className={`bg-[var(--card-bg-2)] border rounded-lg ${m.isFinal ? 'border-amber-500' : 'border-[var(--card-border)]'}`}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              padding: 6,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {m.isFinal && (
              <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                🏆 {m.isThirdPlace ? '3º lugar' : 'Final'}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: 4 }}>
              {renderSlot(m.top, slots, participantesById, campeoesByParticipanteId, large)}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 4 }}>
              {renderSlot(m.bottom, slots, participantesById, campeoesByParticipanteId, large)}
            </div>
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/sorteio-result/BracketTree.tsx
git commit -m "feat(sorteios): BracketTree SVG L-shape connectors entre matches" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: SorteioChaves — dispatch entre BracketTree e legacy

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioChaves.tsx`

- [ ] **Step 1: Atualizar SorteioChaves para usar BracketTree quando matchesGraph presente**

No início do componente, ANTES do bloco `if (!resultado.byePositions)`, adicionar:

```tsx
import BracketTree from './BracketTree'
```

(adicionar no topo do arquivo junto com outros imports).

E no body do componente, ANTES do `if (!resultado.byePositions)`:

```tsx
  // v1.19.0: render fiel via grafo de matches
  if (resultado.matchesGraph && resultado.matchesGraph.matches.length > 0) {
    return (
      <BracketTree
        matchesGraph={resultado.matchesGraph}
        slots={resultado.slots}
        participantesById={participantesById}
        campeoesByParticipanteId={campeoesByParticipanteId}
        large={large}
      />
    )
  }
```

- [ ] **Step 2: tsc + build**

```
cd frontend && npx tsc --noEmit && npm run build
```

- [ ] **Step 3: Commit**

```
git add frontend/src/components/sorteio-result/SorteioChaves.tsx
git commit -m "feat(sorteios): SorteioChaves usa BracketTree quando matchesGraph presente" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Bump v1.19.0 + CHANGELOG + push + smoke

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Mudar `package.json` (root): `"version": "1.18.1"` → `"version": "1.19.0"`.

- [ ] **Step 2: CHANGELOG bloco**

Inserir antes do bloco `## [1.18.1]`:

```md
## [1.19.0] - 2026-05-30

### Added
- Nova tabela `bracket_chaves_matches(numero_inscrito INT PK, matches_graph JSONB)` com grafo completo de matches por N=2..77, extraído da planilha CHAVES CT.xlsx.
- Script `backend/scripts/extract-bracket-graphs.py` lê tabela explícita (N=6..22) + parseia bracket visual (N=2..5, 23..77) com validação obrigatória contra dados explícitos.
- Novo componente `BracketTree.tsx` renderiza bracket de chaves como árvore visual fiel à planilha: cards de match posicionados por coordenadas (round/y) com conectores SVG L-shape entre vencedores e próximas partidas.
- `Sorteio.resultado` agora inclui `matchesGraph` (grafo completo do bracket).
- Final destacada com borda dourada + emoji 🏆. 3rd place marcado.

### Changed
- `SorteioChaves` (frontend) usa `BracketTree` quando `matchesGraph` presente. Render fiel substitui a lista vertical da v1.18.1.

### Notes
- Sorteios pré-v1.19.0 (sem `matchesGraph`) continuam renderizando via builder legado (lista vertical v1.18.1).
- Estruturas asimétricas (N=20, 22, etc.) renderizam fielmente conforme planilha — alguns conectores podem cruzar colunas.
```

- [ ] **Step 3: Commit + push**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.19.0 — bracket de chaves render fiel a planilha (SVG)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin develop
```

- [ ] **Step 4: Aguardar CI (~4-5min — backend migration + frontend build)**

```
curl -s -o /dev/null -w "backend: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperar 200/200.

- [ ] **Step 5: Verificar deploy**

```
ssh wagner@192.168.56.113 "docker exec prosports-frontend-1 sh -c 'grep -oE \"1\\.19\\.0\" /usr/share/nginx/html/assets/*.js | sort -u | head -1'"
```

Esperado: `1.19.0`.

- [ ] **Step 6: Smoke no browser**

http://192.168.56.113:8080 → login admin → Tênis Feminino 21 anos:

1. Re-sortear (N=2): 1 match Final centralizado.
2. Aumentar pra N=6 → re-sortear: árvore com 2 cards R1 + 2 cards R2 (BYE × Venc) + Final dourada. Conectores L-shape visíveis.
3. N=12 com 4 campeões cadastrados → árvore com 4 R1 + 4 R2 + 2 SF + Final. Cabeças aparecem com badge nas posições BYE (1, 6, 7, 12).
4. N=20 → árvore asimétrica. Conectores podem cruzar colunas em alguns pontos (esperado).
5. N=8 (pow2) → árvore balanceada perfeita sem BYEs.
6. Sorteio antigo (Basquete pré-v1.18.0): render legado mantido (não tem matchesGraph).
7. Rodapé: `v1.19.0`.

- [ ] **Step 7: Reportar**

Se smoke passou, feature fechada. Se algum N renderiza estranho (cards sobrepostos, conectores fora de lugar), abrir issue para ajuste de layout (provável ajuste de `POS_ROW_HEIGHT` ou cálculo de `y`).

---

## Self-review

### Cobertura do spec

| Seção do spec | Coberto por |
|---|---|
| Nova tabela `bracket_chaves_matches` (JSONB) | Task 1 |
| Formato do grafo (P/V:/L: refs, final, thirdPlace) | Task 2 (`parse_cell_ref`) + Task 5 (type) |
| Extração explícita N=6..22 | Task 2 |
| Parser visual N=2..5, 23..77 + validação | Task 3 |
| Seed apendado na migration (idempotent) | Task 4 |
| Engine retorna `matchesGraph` | Task 5 |
| Service carrega + valida + passa | Task 5 (Step 7) |
| Tipo `MatchesGraph` no frontend | Task 6 |
| `BracketTree` componente novo (cards + layout) | Task 6 |
| SVG conectores L-shape | Task 7 |
| Final destacada + 3rd place | Task 6 (Step 2) |
| Backwards compat com sorteios antigos | Task 8 (dispatch só quando matchesGraph presente) |
| Bump 1.19.0 + CHANGELOG | Task 9 |
| Smoke pós-deploy | Task 9 (Step 6) |

### Limitações conhecidas

1. **Validação do parser visual:** crítico que passe contra N=6..22 antes de gerar seed. Se falhar para algum N, script aborta — engenheiro precisa investigar critério de pareamento (Step 3 da Task 3 menciona ajustes possíveis).
2. **Layout para N grandes (>32):** cards podem ficar densos verticalmente. `POS_ROW_HEIGHT = 88px` é um chute inicial; ajustar empiricamente.
3. **Cards sobrepostos em estruturas asimétricas:** se 2 matches em rounds adjacentes têm `y` próximos demais, podem se sobrepor. Mitigação: pode precisar de pós-processamento que separa cards conflictantes verticalmente.
4. **Conectores cruzando matches em estruturas asimétricas:** aceito como trade-off de fidelidade.

### Tipos / sinaturas consistentes

- `MatchesGraph` definido em Task 5 (backend engine.ts) e Task 6 (frontend types/sorteio.ts) com mesmo shape.
- `drawBracket` assinatura: `(participantes, regra, regraBracket, matchesGraph, seed, campeoesPids)` — usado em Task 5 (engine), Task 5 (service).
- `bracketChavesMatches.findUnique({ where: { numero_inscrito } })` — Task 5 (service).
