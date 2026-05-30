# Bracket de Chaves por Estrutura da Planilha — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar tabela `bracket_chaves_byes` populada com posições BYE por N (extraídas da planilha CT), engine de chaves que respeita essa estrutura (em vez de `nextPow2` padding) e render frontend em 3 colunas (R1 / Avançam / Demais rodadas).

**Architecture:** Backend tem nova tabela Prisma + seed SQL gerado por script de extração. Engine `drawBracket` recebe `regraBracket` adicional e usa `posicoes_bye` para alocar slots. Frontend `SorteioChaves` detecta `byePositions` no resultado e renderiza R1+R2 corretamente; sem `byePositions` (sorteios antigos), usa builder legado.

**Tech Stack:** Postgres + Prisma + Node 22 + TypeScript + React 18. Script de extração em Python (já validado durante brainstorming).

**Spec:** `docs/superpowers/specs/2026-05-30-bracket-por-planilha-design.md`

---

## File Structure

**Backend — Modify:**
- `backend/prisma/schema.prisma` — adicionar model `BracketChavesByes`.
- `backend/src/modules/sorteios/engine.ts` — adicionar param `regraBracket` em `drawBracket`, novo algoritmo.
- `backend/src/modules/sorteios/engine.test.ts` — testes do novo algoritmo.
- `backend/src/modules/sorteios/sorteios.service.ts` — carregar `bracket_chaves_byes`, passar ao engine, validar ausência.
- `backend/src/modules/sorteios/sorteios.service.test.ts` — mock novo prisma call.

**Backend — Create:**
- `backend/prisma/migrations/{ts}_add_bracket_chaves_byes/migration.sql` — cria tabela.
- `backend/prisma/seeds/bracket_chaves_byes.sql` — INSERTs gerados (76 rows).
- `backend/scripts/extract-bracket-byes.py` — script de extração one-off.

**Frontend — Modify:**
- `frontend/src/types/sorteio.ts` — adicionar `byePositions?: number[]` em `ChavesResultado`.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — builder novo com fallback ao legado.

**Release:**
- `package.json` (root): `1.17.1` → `1.18.0`.
- `CHANGELOG.md`: bloco `[1.18.0]`.

---

## Task 1: Adicionar model `BracketChavesByes` no schema Prisma

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`

- [ ] **Step 1: Adicionar model ao schema**

Inserir o seguinte model no final do arquivo (após `SistemaDisputasChaves`):

```prisma
model BracketChavesByes {
  numero_inscrito Int   @id
  posicoes_bye    Int[]
  @@map("bracket_chaves_byes")
}
```

- [ ] **Step 2: Gerar a migration**

De `backend/`:
```
npx prisma migrate dev --name add_bracket_chaves_byes --create-only
```

Esperado: cria pasta `backend/prisma/migrations/{timestamp}_add_bracket_chaves_byes/migration.sql` com `CREATE TABLE "bracket_chaves_byes" (...)`. NÃO aplicar ainda (precisa adicionar o seed SQL antes na Task 4).

- [ ] **Step 3: Verificar migration.sql gerada**

Abrir o arquivo recém-criado e confirmar o conteúdo. Deve ser algo como:
```sql
CREATE TABLE "bracket_chaves_byes" (
    "numero_inscrito" INTEGER NOT NULL,
    "posicoes_bye" INTEGER[],
    CONSTRAINT "bracket_chaves_byes_pkey" PRIMARY KEY ("numero_inscrito")
);
```

- [ ] **Step 4: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(sorteios): add BracketChavesByes prisma model + migration" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Script de extração da planilha (Python)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\scripts\extract-bracket-byes.py`

Contexto:
- Planilha em `personaladmin/CHAVES CT.xlsx`, 76 abas (N=2..77).
- 17 abas (N=6..22) têm tabela explícita com coluna `isbye` → leitura direta.
- 59 abas (N=2..5 e N=23..77) só têm bracket visual → fallback: usar fórmula derivada `byes_count = min(N - pow2_below, pow2_above - N)` + posições de cabeças (de seeding padrão) marcadas como BYE. Inclui comentário no SQL identificando como "derived" para revisão manual.

- [ ] **Step 1: Criar o script com a lógica completa**

Criar arquivo `backend/scripts/extract-bracket-byes.py`:

```python
#!/usr/bin/env python3
"""
Extract BYE positions per N from personaladmin/CHAVES CT.xlsx.

For N=6..22: reads the explicit 'isbye' column from the SQL-friendly table on
each sheet.

For N=2..5 and N=23..77: uses derived formula
  byes_count = min(N - pow2_below, pow2_above - N)
with standard tournament seeding positions (1, N, N/2+1, N/2, ...). These rows
are commented as DERIVED in the output SQL so a human can verify against the
spreadsheet.

Generates backend/prisma/seeds/bracket_chaves_byes.sql.

Usage:
  cd backend && python scripts/extract-bracket-byes.py
"""
from openpyxl import load_workbook
from pathlib import Path
import math

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / 'personaladmin' / 'CHAVES CT.xlsx'
OUT  = ROOT / 'backend' / 'prisma' / 'seeds' / 'bracket_chaves_byes.sql'

def pow2_below(n: int) -> int:
    return 1 << (n.bit_length() - 1) if n > 0 else 0

def pow2_above(n: int) -> int:
    return 1 << n.bit_length() if (n & (n - 1)) else n

def derived_byes(n: int) -> list[int]:
    """Fallback for sheets without explicit table. Standard seeding."""
    pb, pa = pow2_below(n), pow2_above(n)
    count = min(n - pb, pa - n)
    if count == 0: return []
    # Top seeds for a tournament of size N: 1, N, N/2+1, N/2, N/4+1, ...
    # We pick the first `count` seeds and sort by position.
    seeds = [1, n]
    if count > 2:
        mid_top = (n // 2) + 1
        mid_bot = n // 2
        seeds.extend([mid_top, mid_bot])
    if count > 4:
        # Recurse: split halves
        for q in [n // 4 + 1, n // 4, n * 3 // 4 + 1, n * 3 // 4]:
            if 1 <= q <= n and q not in seeds: seeds.append(q)
    return sorted(seeds[:count])

def explicit_byes(ws, n: int) -> list[int] | None:
    """Read the 'isbye' column from the sheet's SQL table if present."""
    header_row = start_col = None
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            if ws.cell(row=r, column=c).value == 'Chave':
                header_row, start_col = r, c
                break
        if header_row: break
    if not header_row: return None
    byes = []
    for r in range(header_row + 1, header_row + 1 + n):
        pos = ws.cell(row=r, column=start_col + 1).value
        isbye = ws.cell(row=r, column=start_col + 6).value
        if (isinstance(isbye, bool) and isbye) or str(isbye).lower() == 'true':
            byes.append(pos)
    return sorted(byes)

def main():
    wb = load_workbook(XLSX, data_only=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        '-- Auto-generated by backend/scripts/extract-bracket-byes.py',
        '-- DO NOT EDIT MANUALLY. To regenerate: cd backend && python scripts/extract-bracket-byes.py',
        '',
    ]

    for n in range(2, 78):
        sn = f'{n:02d}'
        if sn not in wb.sheetnames: continue
        ws = wb[sn]
        explicit = explicit_byes(ws, n)
        if explicit is not None:
            byes = explicit
            source = 'EXPLICIT (planilha tem tabela isbye)'
        else:
            byes = derived_byes(n)
            source = 'DERIVED (formula min(N-pot2_below, pot2_above-N) + standard seeding) — VERIFICAR'
        arr = '{' + ','.join(str(b) for b in byes) + '}'
        lines.append(f"-- N={n}: {source}")
        lines.append(
            f"INSERT INTO bracket_chaves_byes (numero_inscrito, posicoes_bye) "
            f"VALUES ({n}, '{arr}') "
            f"ON CONFLICT (numero_inscrito) DO UPDATE SET posicoes_bye = EXCLUDED.posicoes_bye;"
        )
        lines.append('')

    OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {OUT} ({len(lines)} lines)')

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Verificar que python + openpyxl estão disponíveis**

Rodar:
```
python --version
python -c "import openpyxl; print(openpyxl.__version__)"
```

Esperado: Python 3.10+ e openpyxl instalado. Se openpyxl ausente: `pip install openpyxl`.

- [ ] **Step 3: Commit o script**

```
git add backend/scripts/extract-bracket-byes.py
git commit -m "feat(sorteios): add bracket bye positions extraction script" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Rodar extração e gerar seed SQL

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\seeds\bracket_chaves_byes.sql`

- [ ] **Step 1: Executar o script**

De `backend/`:
```
python scripts/extract-bracket-byes.py
```

Esperado: imprime `Wrote .../bracket_chaves_byes.sql (~300 lines)`.

- [ ] **Step 2: Inspecionar o arquivo gerado**

Abrir `backend/prisma/seeds/bracket_chaves_byes.sql`. Verificar:
- Comentário inicial presente.
- 76 INSERTs (N=2..77).
- N=6..22 marcados como EXPLICIT.
- N=2..5 e N=23..77 marcados como DERIVED — VERIFICAR.
- Sintaxe Postgres válida (`'{1,6,7,12}'` array literal).

- [ ] **Step 3: Smoke check de valores conhecidos**

Verificar 4 linhas específicas:
- `N=8`: `posicoes_bye = '{}'` (pow2, sem byes).
- `N=12`: `posicoes_bye = '{1,6,7,12}'` (extraído da tabela explícita).
- `N=20`: `posicoes_bye = '{1,10,11,20}'`.
- `N=22`: `posicoes_bye = '{1,6,11,12,17,22}'`.

Se algum não bater → bug no extractor. Investigar e corrigir.

- [ ] **Step 4: Commit do seed**

```
git add backend/prisma/seeds/bracket_chaves_byes.sql
git commit -m "feat(sorteios): generate bracket_chaves_byes seed (N=2..77)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Adicionar seed no fim da migration

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\migrations\{timestamp}_add_bracket_chaves_byes\migration.sql`

- [ ] **Step 1: Abrir a migration criada na Task 1**

Localizar a pasta `backend/prisma/migrations/{timestamp}_add_bracket_chaves_byes/migration.sql`. O conteúdo atual é só o `CREATE TABLE`.

- [ ] **Step 2: Apender o conteúdo do seed**

No FIM do `migration.sql`, adicionar uma linha em branco e depois colar TODO o conteúdo de `backend/prisma/seeds/bracket_chaves_byes.sql`.

Resultado esperado: migration tem CREATE TABLE seguido de 76 INSERTs idempotentes.

Comando (PowerShell):
```powershell
Add-Content -Path "backend\prisma\migrations\{timestamp}_add_bracket_chaves_byes\migration.sql" -Value (Get-Content "backend\prisma\seeds\bracket_chaves_byes.sql" -Raw)
```

Ou copy-paste manual.

- [ ] **Step 3: Aplicar a migration no dev DB**

De `backend/`:
```
npx prisma migrate dev
```

Esperado: aplica migration, sem erros. Verifica que tabela existe + dados inseridos.

- [ ] **Step 4: Smoke check no DB**

Conectar no banco e rodar:
```sql
SELECT numero_inscrito, posicoes_bye FROM bracket_chaves_byes WHERE numero_inscrito IN (8, 12, 20, 22) ORDER BY numero_inscrito;
```

Esperado:
```
 8 | {}
12 | {1,6,7,12}
20 | {1,10,11,20}
22 | {1,6,11,12,17,22}
```

Comando (a partir do host):
```
ssh wagner@192.168.56.113 "docker run --rm postgres:16-alpine psql 'postgresql://prosports:erp0192@192.168.56.108:5432/newprosports' -c 'SELECT numero_inscrito, posicoes_bye FROM bracket_chaves_byes WHERE numero_inscrito IN (8,12,20,22) ORDER BY numero_inscrito;'"
```

- [ ] **Step 5: Commit a migration final**

```
git add backend/prisma/migrations/
git commit -m "feat(sorteios): seed bracket_chaves_byes in migration (idempotent)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Engine `drawBracket` — testes + nova implementação

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\engine.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\engine.test.ts`

Contexto:
- Assinatura atual: `drawBracket(participantes, regra: RegraChaves, seed, campeoesPids = [])`. Retorna `{ size: number, slots: (number|null)[] }`.
- Nova assinatura: `drawBracket(participantes, regraChaves, regraBracket, seed, campeoesPids = [])`. Retorna `{ size, slots, byePositions: number[] }`.
- `RegraBracket = { numero_inscrito: number; posicoes_bye: number[] }` (1-indexed).
- Cabeças já posicionadas via `sistema_disputas_chaves` (sem mudança na regra).

- [ ] **Step 1: Escrever testes failing**

Abrir `backend/src/modules/sorteios/engine.test.ts` e adicionar (no fim, antes do último `})` do describe principal — verificar ESTRUTURA do arquivo primeiro):

```ts
describe('drawBracket — com regraBracket (v1.18.0)', () => {
  const regraChavesN6 = {
    numero_inscrito: 6,
    posicao_primeiro_cabeca: 1,
    posicao_segundo_cabeca: 6,
    posicao_terceiro_cabeca: 4,
    posicao_quarto_cabeca: 3,
  }
  const regraBracketN6 = { numero_inscrito: 6, posicoes_bye: [1, 6] }

  it('aloca cabeças nas posições reservadas e retorna byePositions', () => {
    const pids = [101, 102, 103, 104, 105, 106]
    const campeoes = [101, 102]  // dois campeões cadastrados
    const r = drawBracket(pids, regraChavesN6, regraBracketN6, 'seed-x', campeoes)
    expect(r.size).toBe(6)
    expect(r.slots).toHaveLength(6)
    expect(r.slots[0]).toBe(101)  // 1ª cabeça em pos 1 (1-indexed → idx 0)
    expect(r.slots[5]).toBe(102)  // 2ª cabeça em pos 6 (idx 5)
    expect(r.byePositions).toEqual([1, 6])
  })

  it('preenche posições restantes deterministicamente via seed', () => {
    const pids = [101, 102, 103, 104, 105, 106]
    const r1 = drawBracket(pids, regraChavesN6, regraBracketN6, 'seed-x', [])
    const r2 = drawBracket(pids, regraChavesN6, regraBracketN6, 'seed-x', [])
    expect(r1.slots).toEqual(r2.slots)
  })

  it('N=8 (pow2): sem byes, slots todos preenchidos', () => {
    const regraChavesN8 = {
      numero_inscrito: 8,
      posicao_primeiro_cabeca: 1,
      posicao_segundo_cabeca: 8,
      posicao_terceiro_cabeca: 5,
      posicao_quarto_cabeca: 4,
    }
    const regraBracketN8 = { numero_inscrito: 8, posicoes_bye: [] }
    const pids = [11, 22, 33, 44, 55, 66, 77, 88]
    const r = drawBracket(pids, regraChavesN8, regraBracketN8, 's', [])
    expect(r.byePositions).toEqual([])
    expect(r.slots.filter(s => s !== null)).toHaveLength(8)
  })

  it('N=22 (6 byes, 4 cabeças): 4 cabeças em posições reservadas; 2 byes sobrando recebem random', () => {
    const regraChavesN22 = {
      numero_inscrito: 22,
      posicao_primeiro_cabeca: 1,
      posicao_segundo_cabeca: 22,
      posicao_terceiro_cabeca: 12,
      posicao_quarto_cabeca: 11,
    }
    const regraBracketN22 = { numero_inscrito: 22, posicoes_bye: [1, 6, 11, 12, 17, 22] }
    const pids = Array.from({ length: 22 }, (_, i) => 200 + i)  // 200..221
    const campeoes = [200, 201, 202, 203]
    const r = drawBracket(pids, regraChavesN22, regraBracketN22, 's', campeoes)
    expect(r.slots[0]).toBe(200)    // pos 1
    expect(r.slots[21]).toBe(201)   // pos 22
    expect(r.slots[11]).toBe(202)   // pos 12
    expect(r.slots[10]).toBe(203)   // pos 11
    // posições 6 e 17 (BYEs sobrando) devem ter participantes não-cabeças
    expect(r.slots[5]).not.toBeNull()
    expect(r.slots[16]).not.toBeNull()
    expect([200, 201, 202, 203]).not.toContain(r.slots[5])
    expect([200, 201, 202, 203]).not.toContain(r.slots[16])
    expect(r.byePositions).toEqual([1, 6, 11, 12, 17, 22])
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falham**

De `backend/`:
```
npx vitest run src/modules/sorteios/engine.test.ts --reporter=basic
```

Esperado: testes novos falham — `drawBracket` não aceita o 3º parâmetro `regraBracket`.

- [ ] **Step 3: Atualizar `drawBracket` em `engine.ts`**

Localizar a função `drawBracket` em `backend/src/modules/sorteios/engine.ts` (provavelmente já recebe `(participantes, regra, seed, campeoesPids)`). Substituir por:

```ts
export type RegraBracket = {
  numero_inscrito: number
  posicoes_bye: number[]  // 1-indexed
}

export function drawBracket(
  participantes: number[],
  regra: RegraChaves,
  regraBracket: RegraBracket,
  seed: string,
  campeoesPids: number[] = [],
): { size: number; slots: (number | null)[]; byePositions: number[] } {
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
  const shuffled = shuffleDeterministico(restantes, seed)

  let idx = 0
  for (let i = 0; i < N; i++) {
    if (slots[i] === null && idx < shuffled.length) {
      slots[i] = shuffled[idx++]
    }
  }

  const byePositions = [...regraBracket.posicoes_bye].sort((a, b) => a - b)
  return { size: N, slots, byePositions }
}
```

NOTA: `shuffleDeterministico` é o helper existente que usa mulberry32 + FNV-1a. Manter como está.

NOTA: a assinatura antiga (sem `regraBracket`) será removida. O service na Task 6 vai atualizar a chamada.

- [ ] **Step 4: Atualizar testes legados (se existirem) que chamavam `drawBracket` com 4 args**

Procurar uses antigos:
```
grep -n "drawBracket(" src/modules/sorteios/engine.test.ts
```

Para CADA test legado que chama `drawBracket(participantes, regra, seed, campeoes)`, adicionar `regraBracket` apropriado. Exemplo de update:

ANTES:
```ts
const r = drawBracket([1,2,3,4], regraN4, 'seed', [])
```

DEPOIS:
```ts
const r = drawBracket([1,2,3,4], regraN4, { numero_inscrito: 4, posicoes_bye: [] }, 'seed', [])
```

Para tests que verificam `r.size === pot2_inflado` (comportamento antigo de padding), mudar para `r.size === N` (novo comportamento).

- [ ] **Step 5: Rodar testes novamente — todos devem passar**

```
npx vitest run src/modules/sorteios/engine.test.ts --reporter=basic
```

Esperado: 100% pass.

- [ ] **Step 6: tsc**

```
npx tsc --noEmit
```

Esperado: clean (compiler vai apontar onde mais `drawBracket` é chamado).

- [ ] **Step 7: Commit**

```
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git commit -m "feat(sorteios): drawBracket uses regraBracket.posicoes_bye instead of nextPow2 padding" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Service — carregar `bracket_chaves_byes` + passar ao engine

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\sorteios.service.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\sorteios.service.test.ts`

Contexto:
- Service atual em `executar()` (caso `tipo === 'chaves'`) lê `sistema_disputas_chaves` e chama `engine.drawBracket(pids, regra, seed, campeoesPidsInscritos)`.
- Mudança: ler TAMBÉM `bracket_chaves_byes`, validar, passar ambos ao engine.

- [ ] **Step 1: Escrever teste failing para o caso "regra de bracket ausente"**

Em `backend/src/modules/sorteios/sorteios.service.test.ts`, adicionar mock para `bracketChavesByes.findUnique` no `vi.mock` no topo:

```ts
vi.mock('../../lib/prisma', () => ({
  default: {
    // ... mocks existentes
    bracketChavesByes: {
      findUnique: vi.fn(),
    },
  },
}))
```

E adicionar teste (no describe principal):

```ts
it('executar chaves lança 400 amigável quando bracket_chaves_byes ausente para N', async () => {
  // setup: evento + modalidade tipo chaves + 2 inscritos
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
  mockPrisma.bracketChavesByes.findUnique.mockResolvedValue(null)

  await expect(service.executar({ evento_id: 1, modalidade_id: 1 })).rejects.toMatchObject({
    status: 400,
    message: expect.stringContaining('estrutura de bracket'),
  })
})
```

- [ ] **Step 2: Rodar — esperar falha (referência a `bracketChavesByes` inexistente no service)**

```
cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts --reporter=basic
```

- [ ] **Step 3: Atualizar o service**

Em `backend/src/modules/sorteios/sorteios.service.ts`, dentro do branch `if (tipo === 'chaves')` na função `executar`:

ANTES (aproximadamente):
```ts
} else if (tipo === 'chaves') {
  const regra = await prisma.sistemaDisputasChaves.findFirst({
    where: { numero_inscrito: pids.length },
  })
  if (!regra) {
    throw Object.assign(
      new Error(`Não há regra de chaveamento para ${pids.length} inscritos. Cadastre em Administração.`),
      { status: 400 },
    )
  }
  resultado = engine.drawBracket(pids, regra, seed, campeoesPidsInscritos)
}
```

DEPOIS:
```ts
} else if (tipo === 'chaves') {
  const [regra, regraBracket] = await Promise.all([
    prisma.sistemaDisputasChaves.findFirst({
      where: { numero_inscrito: pids.length },
    }),
    prisma.bracketChavesByes.findUnique({
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
  resultado = engine.drawBracket(pids, regra, regraBracket, seed, campeoesPidsInscritos)
}
```

- [ ] **Step 4: Atualizar testes existentes do service para mockar `bracketChavesByes.findUnique`**

Procurar testes existentes que cobrem o caso `tipo='chaves'` e adicionar mock por default no `beforeEach` ou no setup do teste:

```ts
beforeEach(() => {
  vi.clearAllMocks()
  // Default: bracket structure exists for any N (testes existentes)
  mockPrisma.bracketChavesByes.findUnique.mockResolvedValue({
    numero_inscrito: 0,  // será sobrescrito por testes específicos se necessário
    posicoes_bye: [],
  })
})
```

NOTA: ajuste o mock default conforme o padrão existente do arquivo. Se já há `beforeEach` global, adicionar dentro.

- [ ] **Step 5: Rodar testes — esperar 100% pass**

```
npx vitest run src/modules/sorteios/sorteios.service.test.ts --reporter=basic
```

- [ ] **Step 6: Rodar suite completa do backend**

```
npx vitest run --reporter=basic
```

Esperado: tudo verde.

- [ ] **Step 7: Commit**

```
git add backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.service.test.ts
git commit -m "feat(sorteios): service carrega bracket_chaves_byes e passa ao engine" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — tipo + builder em 3 colunas

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\sorteio.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioChaves.tsx`

- [ ] **Step 1: Atualizar o tipo `ChavesResultado`**

Localizar a definição em `frontend/src/types/sorteio.ts` e adicionar o campo opcional:

```ts
export type ChavesResultado = {
  size: number
  slots: (number | null)[]
  byePositions?: number[]  // 1-indexed; ausente em sorteios pré-v1.18.0
}
```

- [ ] **Step 2: Substituir o componente `SorteioChaves.tsx`**

Substituir TODO o conteúdo de `frontend/src/components/sorteio-result/SorteioChaves.tsx` por:

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

function buildBracketLegacy(slots: readonly (number | null)[]): Match[][] {
  const N = slots.length
  const pot2 = nextPow2(N)
  const bracketSlots: (number | null)[] = [...slots, ...Array(Math.max(0, pot2 - N)).fill(null)]
  const totalRounds = Math.max(1, Math.log2(pot2))
  const result: Match[][] = []

  const round0: Match[] = []
  if (pot2 === 1) {
    round0.push({ id: 'R0M0', round: 0, index: 0, top: bracketSlots[0] ?? null, bottom: null })
  } else {
    for (let i = 0; i < pot2; i += 2) {
      round0.push({
        id: `R0M${i / 2}`, round: 0, index: i / 2,
        top: bracketSlots[i] ?? null,
        bottom: bracketSlots[i + 1] ?? null,
      })
    }
  }
  result.push(round0)
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

function buildR1FromPlanilha(slots: readonly (number | null)[], byePositions: number[]): Match[] {
  const byeSet = new Set(byePositions)
  const nonByeIndices = Array.from({ length: slots.length }, (_, i) => i + 1).filter(p => !byeSet.has(p))
  const matches: Match[] = []
  for (let i = 0; i < nonByeIndices.length; i += 2) {
    matches.push({
      id: `R0M${i / 2}`,
      round: 0,
      index: i / 2,
      top: slots[nonByeIndices[i] - 1] ?? null,
      bottom: (i + 1) < nonByeIndices.length ? (slots[nonByeIndices[i + 1] - 1] ?? null) : null,
    })
  }
  return matches
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
  fallbackText: string
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}

function SlotRender({ pid, fallbackText, large, participantesById, campeoesByParticipanteId }: SlotRenderProps) {
  const fontSize = large ? '1.25rem' : '0.95rem'
  if (pid === null) {
    return <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize }}>{fallbackText}</span>
  }
  const p = participantesById.get(pid)
  const pos = campeoesByParticipanteId?.get(pid)
  if (!p) return <span style={{ color: 'var(--t4)', fontSize }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize, color: 'var(--t1)' }}>
      {pos && <CampeaoBadge posicao={pos} large={large} />}
      <span>
        {p.nome}
        {p.subtitulo && <span style={{ fontSize: '0.85em', color: 'var(--t3)', marginLeft: 4 }}>— {p.subtitulo}</span>}
      </span>
    </span>
  )
}

type MatchCardProps = {
  match: Match
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
  topFallback?: string
  bottomFallback?: string
}

function MatchCard({ match, large, participantesById, campeoesByParticipanteId, topFallback, bottomFallback }: MatchCardProps) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 12 : 8 }}>
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.top} fallbackText={topFallback ?? 'BYE'}
          large={large} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
      <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.bottom} fallbackText={bottomFallback ?? 'BYE'}
          large={large} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
    </div>
  )
}

function ByeCard({ pid, large, participantesById, campeoesByParticipanteId }: {
  pid: number | null
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 12 : 8 }}>
      <div style={{ padding: '4px 0' }}>
        <SlotRender pid={pid} fallbackText="—" large={large} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
      </div>
      <div style={{ fontSize: large ? '0.85rem' : '0.75rem', color: 'var(--t3)', fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
        avança direto
      </div>
    </div>
  )
}

export default function SorteioChaves({ resultado, participantesById, large = false, campeoesByParticipanteId }: Props) {
  // Fallback para sorteios pré-v1.18.0 (sem byePositions)
  if (!resultado.byePositions) {
    const rounds = buildBracketLegacy(resultado.slots)
    return (
      <div style={{ display: 'flex', gap: large ? 32 : 16, overflowX: 'auto', padding: large ? 16 : 8 }}>
        {rounds.map((roundMatches, r) => (
          <div key={r} style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
            gap: large ? 16 : 8, minWidth: large ? 280 : 200, flexShrink: 0,
          }}>
            <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
              {roundLabel(roundMatches.length, r)} · {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
            </div>
            {roundMatches.map(match => (
              <MatchCard key={match.id} match={match} large={large}
                participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
                topFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 1}`}
                bottomFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 2}`}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Novo builder em 3 colunas: R1 / Avançam / Demais rodadas
  const r1 = buildR1FromPlanilha(resultado.slots, resultado.byePositions)
  const colMinWidth = large ? 280 : 200
  const gap = large ? 32 : 16
  const pad = large ? 16 : 8

  return (
    <div style={{ display: 'flex', gap, overflowX: 'auto', padding: pad }}>
      {/* Coluna 1: R1 */}
      {r1.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: large ? 16 : 8, minWidth: colMinWidth, flexShrink: 0 }}>
          <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
            {roundLabel(r1.length, 0)} · {r1.length} {r1.length === 1 ? 'match' : 'matches'}
          </div>
          {r1.map(match => (
            <MatchCard key={match.id} match={match} large={large}
              participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
          ))}
        </div>
      )}

      {/* Coluna 2: BYEs (avançam) */}
      {resultado.byePositions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: large ? 16 : 8, minWidth: colMinWidth, flexShrink: 0 }}>
          <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
            Avançam (BYEs) · {resultado.byePositions.length}
          </div>
          {resultado.byePositions.map((pos, i) => (
            <ByeCard key={`bye-${i}`} pid={resultado.slots[pos - 1] ?? null} large={large}
              participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
          ))}
        </div>
      )}

      {/* Coluna 3: Demais rodadas */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: large ? 16 : 8, minWidth: colMinWidth, flexShrink: 0 }}>
        <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
          Demais rodadas
        </div>
        <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 16 : 12, textAlign: 'center', fontStyle: 'italic', color: 'var(--t3)', fontSize: large ? '1rem' : '0.85rem' }}>
          Conforme regulamento da modalidade
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: clean, vite build OK.

- [ ] **Step 4: Commit**

```
git add frontend/src/types/sorteio.ts frontend/src/components/sorteio-result/SorteioChaves.tsx
git commit -m "feat(sorteios): SorteioChaves render 3-coluna usando byePositions (fallback legacy)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar `"version": "1.17.1"` → `"version": "1.18.0"`.

- [ ] **Step 2: Adicionar bloco no CHANGELOG**

Inserir o bloco abaixo logo após o cabeçalho e antes do bloco `## [1.17.1]`:

```md
## [1.18.0] - 2026-05-30

### Added
- Nova tabela `bracket_chaves_byes(numero_inscrito INT PK, posicoes_bye INT[])` populada com posições de BYE por número de inscritos (N=2..77), extraídas da planilha oficial `CHAVES CT.xlsx`.
- Script de extração `backend/scripts/extract-bracket-byes.py` para regenerar o seed quando a planilha mudar.

### Changed
- Engine `drawBracket` agora usa `bracket_chaves_byes.posicoes_bye` em vez de `nextPow2 - N` para determinar BYEs. Estrutura assimétrica do regulamento (ex.: N=20 com 4 BYEs nas posições 1, 10, 11, 20) preservada.
- `SorteioChaves` (frontend) renderiza bracket em 3 colunas: R1 (pares reais) / Avançam (cards individuais para cada BYE) / Demais rodadas (placeholder "conforme regulamento").
- `Sorteio.resultado` agora inclui `byePositions: number[]` (1-indexed).

### Notes
- Sorteios pré-v1.18.0 (sem `byePositions`) continuam renderizando via builder legado (nextPow2).
- Render fiel de R3+ para estruturas assimétricas (ex.: N=20 onde 4 R1-winners vão direto pra R3) fica para V2.
- Posições BYE para N=2..5 e N=23..77 foram derivadas via fórmula `min(N - pot2_below, pot2_above - N)` + standard seeding. Marcadas como "DERIVED — VERIFICAR" no seed SQL para conferência manual contra a planilha.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.18.0 — bracket de chaves por estrutura da planilha" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Push + smoke pós-deploy

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI reconstrói backend + frontend (~4-5min — backend tem migration nova).

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "backend /health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: ambos 200.

- [ ] **Step 3: Confirmar tabela populada no banco prod**

```
ssh wagner@192.168.56.113 "docker run --rm postgres:16-alpine psql 'postgresql://prosports:erp0192@192.168.56.108:5432/newprosports' -c 'SELECT numero_inscrito, posicoes_bye FROM bracket_chaves_byes WHERE numero_inscrito IN (2, 8, 12, 20, 22, 77) ORDER BY numero_inscrito;'"
```

Esperado: 6 linhas conforme dados extraídos.

- [ ] **Step 4: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. Setup: Tênis Feminino 21 anos (Jogos Regionais de Campinas) está como tipo `chaves`. Cadastrar 2 inscritos. Realizar sorteio.
   - Esperado: backend responde 200. Frontend mostra 1 match em R1 (Final), sem coluna BYE.
2. Repetir com N=6 inscritos. 
   - Esperado: R1 com 2 matches (pares 2-3, 4-5), coluna "Avançam" com 2 cards (pos 1 e pos 6), coluna "Demais rodadas" com placeholder.
3. Repetir com N=12 e 4 campeões cadastrados.
   - Esperado: cabeças ocupam pos 1, 12, 7, 6 (todas BYEs). Coluna "Avançam" mostra os 4 nomes de campeões com badge.
4. Repetir com N=22.
   - Esperado: 6 BYEs (1, 6, 11, 12, 17, 22). Cabeças nas 4 reservadas, pos 6 e 17 com participantes aleatórios.
5. Abrir um sorteio antigo (Basquete Feminino 21 anos, sorteio id=1 com tipo=grupos — esse é grupos, não chaves; se houver algum sorteio chaves antigo, abrir esse).
   - Esperado: render legado funciona (sem `byePositions`).
6. Rodapé sidebar: `v1.18.0`.

- [ ] **Step 5: Reportar status**

Se passou: feature fechada. Documentar em CHANGELOG que N=2..5 e N=23..77 ainda precisam revisão manual contra planilha.

---

## Self-review

### Cobertura do spec

| Seção/Requisito do spec | Coberto por |
|---|---|
| Nova tabela `bracket_chaves_byes(numero_inscrito, posicoes_bye)` | Task 1 |
| Extração de N=6..22 via tabela explícita | Task 2 (`explicit_byes`) + Task 3 |
| Extração de N=2..5, 23..77 via "parser visual" (revisado: usar fórmula derivada com flag VERIFICAR) | Task 2 (`derived_byes`) + Task 3 |
| Casos triviais N=2,3,4 hardcoded | Task 2 (fórmula retorna `[]` para N pow2; outros são derived) |
| Seed `.sql` no repo | Task 3 + Task 4 (apendado na migration) |
| Migration cria tabela + popula via INSERT idempotente | Task 4 |
| Engine `drawBracket` com novo param `regraBracket` + retorna `byePositions` | Task 5 |
| Service carrega `bracket_chaves_byes` + passa ao engine + 400 amigável se ausente | Task 6 |
| Tipo `ChavesResultado` ganha `byePositions?` (opcional, retrocompat) | Task 7 |
| Frontend render 3 colunas (R1 / Avançam / Demais rodadas) | Task 7 |
| Fallback legacy para sorteios pré-v1.18.0 | Task 7 (`buildBracketLegacy` preservado) |
| Cabeças continuam usando `sistema_disputas_chaves` (regra preservada) | Task 5 (engine sem mudança nessa lógica) |
| Bump v1.18.0 + CHANGELOG | Task 8 |
| Smoke pós-deploy | Task 9 |

### Limitações conhecidas (documentadas no CHANGELOG)

1. Posições BYE para N=2..5 e N=23..77 derivadas via fórmula + standard seeding — não 100% validadas contra a planilha CT. Operadores devem conferir e abrir issue se discrepância encontrada.
2. Render de R3+ é placeholder "Conforme regulamento" — V2 trará árvore completa via importação do grafo de matches da planilha.
3. Para N ausente da tabela (impossível com seed completo, mas defensivo): service retorna 400 amigável.

### Tipos / sinaturas consistentes

- `RegraBracket = { numero_inscrito: number; posicoes_bye: number[] }` — usado em Task 5 (engine) e Task 6 (service).
- `ChavesResultado` ganha `byePositions?: number[]` — Task 7 (tipo), Task 5 (engine retorna), Task 7 (frontend lê).
- Prisma `bracketChavesByes.findUnique` — Task 6 (service).
