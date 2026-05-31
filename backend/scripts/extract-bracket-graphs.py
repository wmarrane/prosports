#!/usr/bin/env python3
"""
Extract full match graph per N from personaladmin/CHAVES CT.xlsx.

Strategy for N=6..22 (sheets with both SQL table and resolved matches list):
  - Read the matches list on the right side ('Jogos' column): each match has
    top/bottom raw values (some resolved as 'Venc.Jx'/'Perd.Jx', some as 0 or
    #REF! placeholders for positions).
  - Read the SQL-friendly positions table at the bottom: provides per-position
    info (rodada, primeira_rodada, segunda_rodada, isbye).
  - Fill in the placeholders from the matches list using the positions table:
      * R1 match (both top and bottom unknown): both positions from
        positions_table where primeira == match_id.
      * R2 BYE match (one side unknown, other is Venc.Jx): unknown side is the
        BYE position from positions_table where isbye=true and segunda starts
        with match_id.
  - The Venc.Jx/Perd.Jx references for R3+ matches are extracted as-is from
    the matches list right side (they ARE resolved in data_only mode).

For N=2..5 and N=23..77 the SQL table is absent — task 3 will add visual parser.

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

def parse_simple_ref(value):
    """Normalize cell value to graph reference.

    - Integer or numeric string => 'P{n}' (position).
    - 'Venc.J{x}' => 'V:J{x}'.
    - 'Perd.J{x}' => 'L:J{x}'.
    - None/blank/'null'/'0'/'#REF!' => None (placeholder, unresolved).
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
    list of (match_id, top_raw, bottom_raw). Header label is 'Jogos'.
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
    for r in range(jogo_row + 1, ws.max_row + 1):
        prefix = ws.cell(row=r, column=jogo_col).value
        if prefix != 'J': break
        n = ws.cell(row=r, column=jogo_col + 1).value
        top = ws.cell(row=r, column=jogo_col + 2).value
        bot = ws.cell(row=r, column=jogo_col + 4).value
        if n is None: continue
        out.append((f'J{int(n)}', top, bot))
    return out

def find_positions_table(ws):
    """Locate the SQL-friendly table with 'Chave' header. Returns
    (header_row, chave_col) or (None, None).
    """
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            if ws.cell(row=r, column=c).value == 'Chave':
                return r, c
    return None, None

def parse_positions_table(ws, N):
    """Read positions table for N. Returns list of dicts or None if absent."""
    header_row, chave_col = find_positions_table(ws)
    if header_row is None: return None
    rows = []
    for r in range(header_row + 1, header_row + 1 + N):
        chave = ws.cell(row=r, column=chave_col).value
        if chave is None: return None
        posicao = ws.cell(row=r, column=chave_col + 1).value
        rodada = ws.cell(row=r, column=chave_col + 3).value
        primeira = ws.cell(row=r, column=chave_col + 4).value
        segunda = ws.cell(row=r, column=chave_col + 5).value
        isbye = ws.cell(row=r, column=chave_col + 6).value
        if not isinstance(posicao, int): return None
        rows.append({
            'posicao': posicao,
            'rodada': int(rodada) if rodada is not None else None,
            'primeira': str(primeira).strip() if primeira not in (None, 'null') else None,
            'segunda': str(segunda).strip() if segunda not in (None, 'null') else None,
            'isbye': bool(isbye) if isinstance(isbye, bool) else str(isbye).lower() == 'true',
        })
    return rows

def derive_rounds(matches):
    """Assign 'round' to each match based on dependencies (topo sort).

    Round 1: both top/bottom are positions (P{n}).
    Round k: max(round of dep) + 1.
    """
    rounds = {}
    pending = list(matches)
    while pending:
        next_pending = []
        progress = False
        for m in pending:
            mid = m['id']
            deps = []
            for ref in (m['top'], m['bottom']):
                if ref.startswith('V:') or ref.startswith('L:'):
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
    """Combine matches list (right side) + positions table (bottom).

    Returns dict or None if either source is incomplete.
    """
    raw = find_matches_list(ws)
    if not raw: return None
    positions_table = parse_positions_table(ws, N)
    if positions_table is None: return None

    # R1 lookup: match_id -> [pos1, pos2] sorted.
    r1_lookup = {}
    for row in positions_table:
        if row['primeira']:
            r1_lookup.setdefault(row['primeira'], []).append(row['posicao'])
    for mid in r1_lookup:
        r1_lookup[mid].sort()

    # R2 BYE lookup: match_id -> bye_position.
    r2_bye_lookup = {}
    for row in positions_table:
        if row['isbye'] and row['segunda']:
            parts = [p.strip() for p in row['segunda'].split(',')]
            if len(parts) != 2: continue
            match_id, _opp = parts
            r2_bye_lookup[match_id] = row['posicao']

    matches = []
    third_place = None
    for mid, top_raw, bot_raw in raw:
        top = parse_simple_ref(top_raw)
        bot = parse_simple_ref(bot_raw)
        # Fill unresolved sides from positions table.
        if top is None and bot is None:
            # R1 match: both positions from r1_lookup.
            if mid in r1_lookup and len(r1_lookup[mid]) == 2:
                pa, pb = r1_lookup[mid]
                top = f'P{pa}'
                bot = f'P{pb}'
        elif top is None:
            # BYE position is the unresolved side.
            if mid in r2_bye_lookup:
                top = f'P{r2_bye_lookup[mid]}'
        elif bot is None:
            if mid in r2_bye_lookup:
                bot = f'P{r2_bye_lookup[mid]}'
        if top is None or bot is None:
            return None  # incomplete data
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
        try:
            g = explicit_graph(ws, n)
        except Exception as e:
            print(f'ERROR N={n}: {e}')
            g = None
        if g is None:
            missing.append(n)
            lines.append(f'-- N={n}: PENDING (visual parser not yet implemented; will add in task 3)')
            lines.append('')
            continue
        graph_json = json.dumps(g, separators=(',', ':'))
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
