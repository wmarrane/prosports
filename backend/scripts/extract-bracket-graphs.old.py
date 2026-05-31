#!/usr/bin/env python3
"""
Extract full match graph per N from personaladmin/CHAVES CT.xlsx.

Universal strategy (works for all N=2..77):

1. Read BYE positions per N from backend/prisma/seeds/bracket_chaves_byes.sql
   (already generated in v1.18.0).

2. Read matches list (right side of each sheet, 'Jogos' column). This list is
   present for all sheets and exposes the R2+ structure via 'Venc.Jx' and
   'Perd.Jx' references — these ARE resolved even when position cells show as
   '#REF!' (because openpyxl data_only=True evaluates the simple text refs).

3. Reconstruct the graph:
   - R1 matches: matches whose top AND bottom are placeholders. Assign
     sequential non-BYE positions in pairs (1st R1 match gets first pair, etc.).
   - R2 BYE matches: matches where one side is a Venc.Jx and other is a
     placeholder. Assign BYE positions in order (1st BYE match gets 1st BYE,
     etc.).
   - R3+ matches: top and bottom are both Venc.Jx/Perd.Jx — used as-is.
   - 3rd place match: detected via Perd.Jx references.

4. Trivial cases (no matches list): hardcoded for N=2.

Usage:
  cd backend && python scripts/extract-bracket-graphs.py
"""
from openpyxl import load_workbook
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / 'personaladmin' / 'CHAVES CT.xlsx'
BYES_SQL = ROOT / 'backend' / 'prisma' / 'seeds' / 'bracket_chaves_byes.sql'
OUT = ROOT / 'backend' / 'prisma' / 'seeds' / 'bracket_chaves_matches.sql'

def load_bye_positions():
    """Parse bracket_chaves_byes.sql to map N -> [bye_pos, ...]."""
    if not BYES_SQL.exists():
        raise RuntimeError(f'Required seed file missing: {BYES_SQL}. Run v1.18.0 extraction first.')
    text = BYES_SQL.read_text(encoding='utf-8')
    out = {}
    # Match: VALUES (N, '{1,6,12}') or VALUES (N, '{}')
    for m in re.finditer(r"VALUES\s*\(\s*(\d+)\s*,\s*'\{([\d,\s]*)\}'", text):
        n = int(m.group(1))
        arr = m.group(2).strip()
        positions = [int(x) for x in arr.split(',') if x.strip()] if arr else []
        out[n] = sorted(positions)
    return out

def parse_simple_ref(value):
    """Parse cell to ref string. Returns None for unresolved placeholders.

    - 'Venc.Jx' => 'V:Jx'
    - 'Perd.Jx' => 'L:Jx'
    - integer => 'P{n}'
    - 0/#REF!/null/'' => None
    """
    if value is None: return None
    s = str(value).strip()
    if s in ('', '0', 'null', '#REF!', '#N/A'): return None
    if re.fullmatch(r'\d+', s): return f'P{s}'
    # Tolerate variations: 'Venc.J5', 'VencJ5', 'venc j 5', etc.
    m = re.fullmatch(r'Venc\.?\s*J\s*(\d+)', s, re.IGNORECASE)
    if m: return f'V:J{m.group(1)}'
    m = re.fullmatch(r'Perd\.?\s*J\s*(\d+)', s, re.IGNORECASE)
    if m: return f'L:J{m.group(1)}'
    return None

def find_matches_list(ws):
    """Locate the matches list. Returns [(match_id, top_raw, bot_raw)].

    Match numbers in column +1 are sometimes empty (formula returns blank or
    #N/A). Derive sequentially from row order: 1st 'J' row = J1, etc.
    """
    jogo_row = jogo_col = None
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            if ws.cell(row=r, column=c).value == 'Jogos':
                jogo_row, jogo_col = r, c
                break
        if jogo_row: break
    if not jogo_row: return []
    out = []
    seq = 0
    for r in range(jogo_row + 1, ws.max_row + 1):
        if ws.cell(row=r, column=jogo_col).value != 'J': break
        seq += 1
        n_cell = ws.cell(row=r, column=jogo_col + 1).value
        # Prefer explicit number from cell, fall back to sequence.
        if isinstance(n_cell, int):
            n = n_cell
        else:
            n = seq
        top = ws.cell(row=r, column=jogo_col + 2).value
        bot = ws.cell(row=r, column=jogo_col + 4).value
        out.append((f'J{n}', top, bot))
    return out

def derive_rounds(matches):
    """Topological assignment of round numbers."""
    rounds = {}
    pending = list(matches)
    while pending:
        next_pending = []
        progress = False
        for m in pending:
            deps = []
            for ref in (m['top'], m['bottom']):
                if ref.startswith('V:') or ref.startswith('L:'):
                    deps.append(ref[2:])
            if not deps:
                rounds[m['id']] = 1
                progress = True
            elif all(d in rounds for d in deps):
                rounds[m['id']] = max(rounds[d] for d in deps) + 1
                progress = True
            else:
                next_pending.append(m)
        if not progress:
            raise RuntimeError(f'Cannot derive rounds for: {[m["id"] for m in next_pending]}')
        pending = next_pending
    for m in matches:
        m['round'] = rounds[m['id']]
    return matches

def build_graph(raw_matches, bye_positions, N):
    """Build graph from matches list + BYE positions."""
    bye_set = set(bye_positions)
    non_bye = [p for p in range(1, N + 1) if p not in bye_set]

    # Classify each match by what's known in top/bottom.
    classified = []  # [(mid, top_parsed, bot_parsed)]
    for mid, t, b in raw_matches:
        tp = parse_simple_ref(t)
        bp = parse_simple_ref(b)
        classified.append((mid, tp, bp))

    # R1 matches: both top and bottom unresolved.
    r1_match_ids = [mid for mid, tp, bp in classified if tp is None and bp is None]
    # BYE matches: exactly one side unresolved AND the other side starts with V:.
    bye_match_ids = []
    for mid, tp, bp in classified:
        if (tp is None) != (bp is None):  # XOR
            other = bp if tp is None else tp
            if other and other.startswith('V:'):
                bye_match_ids.append(mid)
    # Sort by match number for sequential assignment.
    r1_match_ids.sort(key=lambda x: int(x[1:]))
    bye_match_ids.sort(key=lambda x: int(x[1:]))

    # Assign sequential non-BYE positions to R1 matches.
    if len(r1_match_ids) * 2 != len(non_bye):
        raise RuntimeError(
            f'N={N}: {len(r1_match_ids)} R1 matches need {2*len(r1_match_ids)} non-BYE positions, '
            f'but {len(non_bye)} available')
    r1_resolved = {}
    for i, mid in enumerate(r1_match_ids):
        r1_resolved[mid] = (f'P{non_bye[2*i]}', f'P{non_bye[2*i+1]}')

    # Assign BYE positions to BYE matches.
    if len(bye_match_ids) != len(bye_positions):
        # Some BYEs don't have a corresponding match (theoretical edge case)
        # or extra matches got classified as BYE. Be tolerant: assign min(len).
        if len(bye_match_ids) > len(bye_positions):
            raise RuntimeError(
                f'N={N}: {len(bye_match_ids)} BYE matches but only {len(bye_positions)} BYE positions')
    bye_resolved = {}
    for i, mid in enumerate(bye_match_ids):
        if i < len(bye_positions):
            bye_resolved[mid] = f'P{bye_positions[i]}'

    # Now build the final matches array.
    matches = []
    third_place = None
    for mid, tp, bp in classified:
        if mid in r1_resolved:
            top, bot = r1_resolved[mid]
        elif mid in bye_resolved:
            # Whichever side is None becomes the BYE position.
            if tp is None:
                top, bot = bye_resolved[mid], bp
            else:
                top, bot = tp, bye_resolved[mid]
        else:
            top, bot = tp, bp
        if top is None or bot is None:
            raise RuntimeError(f'N={N} {mid}: unresolved top={tp!r} bot={bp!r}')
        if top.startswith('L:') or bot.startswith('L:'):
            third_place = mid
        matches.append({'id': mid, 'top': top, 'bottom': bot})

    derive_rounds(matches)
    max_round = max(m['round'] for m in matches if m['id'] != third_place)
    final_match = next(m['id'] for m in matches if m['round'] == max_round and m['id'] != third_place)

    return {
        'matches': matches,
        'final': final_match,
        'thirdPlace': third_place,
    }

def trivial_graph(N):
    """Hardcoded for tiny N where matches list may be absent."""
    if N == 2:
        return {
            'matches': [{'id': 'J1', 'round': 1, 'top': 'P1', 'bottom': 'P2'}],
            'final': 'J1',
            'thirdPlace': None,
        }
    return None

def main():
    wb = load_workbook(XLSX, data_only=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    byes_map = load_bye_positions()
    print(f'Loaded BYE data for {len(byes_map)} N values')

    lines = [
        '-- Auto-generated by backend/scripts/extract-bracket-graphs.py',
        '-- DO NOT EDIT MANUALLY. To regenerate: cd backend && python scripts/extract-bracket-graphs.py',
        '',
    ]
    ok = []
    failed = []
    for n in range(2, 78):
        sn = f'{n:02d}'
        if sn not in wb.sheetnames: continue
        ws = wb[sn]
        bye_positions = byes_map.get(n, [])
        try:
            raw = find_matches_list(ws)
            if not raw:
                g = trivial_graph(n)
                if g is None:
                    raise RuntimeError('no matches list and no trivial fallback')
            else:
                g = build_graph(raw, bye_positions, n)
            ok.append(n)
        except Exception as e:
            failed.append((n, str(e)))
            lines.append(f'-- N={n}: FAILED ({e})')
            lines.append('')
            continue
        graph_json = json.dumps(g, separators=(',', ':'))
        escaped = graph_json.replace("'", "''")
        lines.append(f'-- N={n}')
        lines.append(
            f"INSERT INTO bracket_chaves_matches (numero_inscrito, matches_graph) "
            f"VALUES ({n}, '{escaped}'::jsonb) "
            f"ON CONFLICT (numero_inscrito) DO UPDATE SET matches_graph = EXCLUDED.matches_graph;"
        )
        lines.append('')

    OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {OUT}')
    print(f'OK: {len(ok)} N values')
    print(f'FAILED: {len(failed)} N values')
    for n, msg in failed:
        print(f'  N={n}: {msg}')

if __name__ == '__main__':
    main()
