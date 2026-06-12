# Modalidade ativa/inativa + Status de evento "Suspenso" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) Ativar/desativar uma modalidade na competição (oculta dos eventos preservando dados); (B) novo status de evento "Suspenso" (card âmbar + bloqueio de ações).

**Architecture:** (A) campo booleano `Modalidade.ativa` filtrado nos mesmos pontos centralizados de "modalidades do evento"; toggle na gestão. (B) novo valor de enum `EventoStatus.suspenso`; guardrail server-side no sorteio + UI (card âmbar, botões desabilitados). Duas migrations manuais.

**Tech Stack:** Node/Express, Prisma/PostgreSQL, zod, Vitest (mock prisma); React 18 + TS + Vite, react-query.

Specs: `docs/superpowers/specs/2026-06-12-ativar-desativar-modalidade-design.md` e `docs/superpowers/specs/2026-06-12-evento-status-suspenso-design.md`.

---

## File Structure

**A — Modalidade ativa**
- `backend/prisma/schema.prisma` + migration `20260612000000_add_ativa_modalidade`.
- `backend/src/modules/modalidades/modalidades.service.ts` + `.controller.ts` + `.routes.ts` — `setAtiva`.
- `backend/src/modules/eventos/evento-modalidades.service.ts`, `backend/src/modules/eventos/eventos.service.ts`, `backend/src/modules/key_access/key_access.service.ts`, `backend/src/modules/site-publico/site-publico.service.ts`, `backend/src/modules/relatorios/relatorio_congresso.service.ts` — filtrar `ativa: true`.
- `frontend/src/types/modalidade.ts`, `frontend/src/services/modalidades.ts`, `frontend/src/pages/competicoes/ModalidadesPanel.tsx`, `frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx`.

**B — Status Suspenso**
- `backend/prisma/schema.prisma` + migration `20260612000100_add_status_suspenso`.
- `backend/src/modules/sorteios/sorteios.service.ts` — guardrail.
- `frontend/src/types/evento.ts`, `frontend/src/lib/evento-status.ts`, `frontend/src/pages/eventos/EventoForm.tsx`, `frontend/src/pages/eventos/EventosList.tsx`, `frontend/src/pages/eventos/EventoInscricoes.tsx`.

---

## Task 1: Modalidade.ativa — schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260612000000_add_ativa_modalidade/migration.sql`

- [ ] **Step 1: Schema** — no model `Modalidade` (`backend/prisma/schema.prisma`), adicionar o campo logo após `chave_versao        String          @default("V1")`:
```prisma
  ativa               Boolean         @default(true)
```

- [ ] **Step 2: Migration** — criar `backend/prisma/migrations/20260612000000_add_ativa_modalidade/migration.sql`:
```sql
ALTER TABLE "Modalidade" ADD COLUMN "ativa" BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 3: Generate + validate + build**
Run: `cd backend && npx prisma generate` → "Generated Prisma Client".
Run: `cd backend && npx prisma validate` → "valid".
Run: `cd backend && npm run build` → tsc limpo.
(NÃO rodar `migrate dev`.)

- [ ] **Step 4: Commit**
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260612000000_add_ativa_modalidade
git commit -m "feat(db): campo Modalidade.ativa (ativar/desativar na competição)"
```

---

## Task 2: Endpoint `setAtiva`

**Files:**
- Modify: `backend/src/modules/modalidades/modalidades.service.ts`
- Modify: `backend/src/modules/modalidades/modalidades.controller.ts`
- Modify: `backend/src/modules/modalidades/modalidades.routes.ts`
- Test: `backend/src/modules/modalidades/modalidades.service.test.ts`

- [ ] **Step 1: Teste** — em `backend/src/modules/modalidades/modalidades.service.test.ts`, garantir que o mock de prisma tenha `modalidade.update`. Adicionar:
```ts
  it('setAtiva atualiza o flag ativa', async () => {
    mockPrisma.modalidade.update.mockResolvedValue({ id: 3, ativa: false })
    const r = await service.setAtiva(3, false)
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { ativa: false },
      include: { competicao: true, tipo_modalidade: true },
    })
    expect(r).toEqual({ id: 3, ativa: false })
  })
```
Run: `cd backend && npx vitest run src/modules/modalidades/modalidades.service.test.ts` → FAIL (setAtiva não existe).

- [ ] **Step 2: Service** — em `backend/src/modules/modalidades/modalidades.service.ts`, adicionar (após `remover`); o `INCLUDE` já existe no topo do arquivo (`{ competicao: true, tipo_modalidade: true }`):
```ts
export async function setAtiva(id: number, ativa: boolean) {
  return prisma.modalidade.update({ where: { id }, data: { ativa }, include: INCLUDE })
}
```
Run o teste → PASS.

- [ ] **Step 3: Controller + rota** — em `backend/src/modules/modalidades/modalidades.controller.ts`, adicionar (zod já importado):
```ts
const ativaSchema = z.object({ ativa: z.boolean() })

export async function setAtiva(req: Request, res: Response, next: NextFunction) {
  try {
    const { ativa } = ativaSchema.parse(req.body)
    res.json(await service.setAtiva(Number(req.params.id), ativa))
  } catch (err) { next(err) }
}
```
Em `backend/src/modules/modalidades/modalidades.routes.ts`, adicionar (após a rota PUT `/:id`, e antes de `export default`; `admin` já está definido no arquivo):
```ts
router.patch('/:id/ativa', ...admin, ctrl.setAtiva)
```

- [ ] **Step 4: Build** — `cd backend && npm run build` → tsc limpo.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/modalidades/modalidades.service.ts backend/src/modules/modalidades/modalidades.controller.ts backend/src/modules/modalidades/modalidades.routes.ts backend/src/modules/modalidades/modalidades.service.test.ts
git commit -m "feat(modalidades): endpoint PATCH /:id/ativa"
```

---

## Task 3: Filtrar `ativa=true` nas saídas de "modalidades do evento"

**Files:**
- Modify: `backend/src/modules/eventos/evento-modalidades.service.ts`
- Modify: `backend/src/modules/eventos/eventos.service.ts`
- Modify: `backend/src/modules/eventos/eventos.service.test.ts`
- Modify: `backend/src/modules/key_access/key_access.service.ts`
- Modify: `backend/src/modules/site-publico/site-publico.service.ts`
- Modify: `backend/src/modules/relatorios/relatorio_congresso.service.ts`
- Test: `backend/src/modules/eventos/evento-modalidades.service.test.ts`

- [ ] **Step 1: `modalidadesDoEvento` filtra ativa** — em `backend/src/modules/eventos/evento-modalidades.service.ts`, na chamada `prisma.modalidade.findMany`, trocar o `where: { competicao_id: evento.competicao_id }` por:
```ts
      where: { competicao_id: evento.competicao_id, ativa: true },
```

- [ ] **Step 2: Teste do helper** — em `backend/src/modules/eventos/evento-modalidades.service.test.ts`, adicionar uma asserção de que a query inclui `ativa: true`. Adicionar este teste:
```ts
  it('modalidadesDoEvento filtra apenas modalidades ativas', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 10, competicao_id: 7 })
    mockPrisma.modalidade.findMany.mockResolvedValue([])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([])
    await service.modalidadesDoEvento(10)
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { competicao_id: 7, ativa: true } }),
    )
  })
```
Run: `cd backend && npx vitest run src/modules/eventos/evento-modalidades.service.test.ts` → PASS (incl. o novo).

- [ ] **Step 3: `eventos.service.listar` ignora inativas no contador** — em `backend/src/modules/eventos/eventos.service.ts`, no `LIST_INCLUDE`, a parte `competicao.include.modalidades` passa a filtrar ativas. Trocar:
```ts
      modalidades: {
        select: {
          id: true,
          mensagens_inscritos: true,
          tipo_modalidade: { select: { tipo: true } },
        },
      },
```
por:
```ts
      modalidades: {
        where: { ativa: true },
        select: {
          id: true,
          mensagens_inscritos: true,
          tipo_modalidade: { select: { tipo: true } },
        },
      },
```

- [ ] **Step 4: Ajustar o teste de eventos.service** — em `backend/src/modules/eventos/eventos.service.test.ts`, no objeto `LIST_INCLUDE` usado nas asserções, adicionar `where: { ativa: true }` dentro de `competicao.include.modalidades` para casar com a query (mesma forma do Step 3).
Run: `cd backend && npx vitest run src/modules/eventos/eventos.service.test.ts` → PASS.

- [ ] **Step 5: key-access filtra ativa** — em `backend/src/modules/key_access/key_access.service.ts`, em `getModalidades`, no `prisma.modalidade.findMany`, trocar `where: { competicao_id: evento.competicao_id }` por:
```ts
      where: { competicao_id: evento.competicao_id, ativa: true },
```

- [ ] **Step 6: site-publico filtra ativa** — em `backend/src/modules/site-publico/site-publico.service.ts`, em `publicar`, no `prisma.modalidade.findMany`, trocar `where: { competicao_id: evento.competicao_id }` por:
```ts
    where: { competicao_id: evento.competicao_id, ativa: true },
```

- [ ] **Step 7: relatório filtra ativa** — em `backend/src/modules/relatorios/relatorio_congresso.service.ts`, em `loadEventoComModalidades`, no include `competicao.modalidades`, adicionar `where: { ativa: true }`. Trocar:
```ts
          modalidades: {
            include: { tipo_modalidade: true },
            orderBy: { nome: 'asc' },
          },
```
por:
```ts
          modalidades: {
            where: { ativa: true },
            include: { tipo_modalidade: true },
            orderBy: { nome: 'asc' },
          },
```

- [ ] **Step 8: Build + suíte** — `cd backend && npm run build` → tsc limpo. `cd backend && npx vitest run` → toda a suíte passa (ajustar quaisquer asserções deep-equal de `where`/include que tenham quebrado por causa do `ativa`, mantendo a intenção dos testes).

- [ ] **Step 9: Commit**
```bash
git add backend/src/modules/eventos backend/src/modules/key_access/key_access.service.ts backend/src/modules/site-publico/site-publico.service.ts backend/src/modules/relatorios/relatorio_congresso.service.ts
git commit -m "feat(eventos): respeitar Modalidade.ativa nas saídas do evento (contadores, mobile, site, relatório)"
```

---

## Task 4: Frontend — toggle de ativa na gestão

**Files:**
- Modify: `frontend/src/types/modalidade.ts`
- Modify: `frontend/src/services/modalidades.ts`
- Modify: `frontend/src/pages/competicoes/ModalidadesPanel.tsx`
- Modify: `frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx`

- [ ] **Step 1: Tipo** — em `frontend/src/types/modalidade.ts`, dentro de `export type Modalidade = { ... }`, adicionar:
```ts
  ativa: boolean
```

- [ ] **Step 2: Serviço** — em `frontend/src/services/modalidades.ts`, dentro de `modalidadesService`, adicionar:
```ts
  setAtiva: (id: number, ativa: boolean) =>
    api.patch<Modalidade>(`${BASE}/${id}/ativa`, { ativa }).then(r => r.data),
```

- [ ] **Step 3: ModalidadesPanel — toggle + visual** — em `frontend/src/pages/competicoes/ModalidadesPanel.tsx`:

(a) adicionar a mutation (junto às outras, após `remover`):
```tsx
  const { mutate: toggleAtiva } = useMutation({
    mutationFn: ({ id, ativa }: { id: number; ativa: boolean }) => modalidadesService.setAtiva(id, ativa),
    onSuccess: invalidate,
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao alterar status.'),
  })
  const [desativarAlvo, setDesativarAlvo] = useState<{ id: number; nome: string } | null>(null)
```

(b) na renderização de cada linha de modalidade (`modalidades.map(m => { ... })`), usar `m.ativa` para esmaecer e marcar. No container `<div key={m.id} style={{...}}>`, adicionar `opacity: m.ativa ? 1 : 0.55` ao style. Após o bloco do nome/sigla (dentro do `<div style={{ flex: 1 ... }}>`, junto do tipo), quando inativa, mostrar um selo:
```tsx
                    {!m.ativa && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--warn-700)', background: 'var(--warn-soft)', border: '1px solid var(--warn)', padding: '1px 6px', borderRadius: 'var(--radius-pill)' }}>Inativa</span>
                    )}
```

(c) no grupo de ações da linha (o `<div className="flex gap-3 flex-shrink-0">` com Editar/Remover), adicionar ANTES do "Editar" um botão Ativar/Desativar:
```tsx
                  <button
                    type="button"
                    onClick={() => m.ativa ? setDesativarAlvo({ id: m.id, nome: m.nome }) : toggleAtiva({ id: m.id, ativa: true })}
                    className="text-xs font-semibold"
                    style={{ color: m.ativa ? 'var(--warn-700)' : 'var(--success-700)' }}
                  >
                    {m.ativa ? 'Desativar' : 'Ativar'}
                  </button>
```

(d) montar um modal de confirmação de desativação (perto do modal de remover, no fim do componente):
```tsx
      {desativarAlvo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }} onClick={() => setDesativarAlvo(null)}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-2xl)', padding: 32, maxWidth: 480, width: '100%', margin: '0 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>Desativar modalidade?</h3>
            <p style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 24 }}>
              Os eventos desta competição deixarão de ver <b style={{ color: 'var(--t1)' }}>{desativarAlvo.nome}</b>. Inscritos e sorteios ficam ocultos e voltam ao reativar.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={() => setDesativarAlvo(null)} style={{ background: 'transparent', color: 'var(--t1)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button type="button" onClick={() => { toggleAtiva({ id: desativarAlvo.id, ativa: false }); setDesativarAlvo(null) }} style={{ background: 'var(--warn)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Desativar</button>
            </div>
          </div>
        </div>
      )}
```
(`useState` já está importado no arquivo.)

- [ ] **Step 4: Painel per-evento só lista ativas** — em `frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx`, onde itera `modalidades` (a query `['modalidades', competicaoId]`), filtrar para ativas. Trocar a derivação usada na renderização/efeito para considerar só ativas: logo após obter `modalidades`, criar:
```tsx
  const modalidadesAtivas = modalidades.filter(m => m.ativa)
```
e usar `modalidadesAtivas` no `useEffect` que monta `participa` e no `.map` da lista e no cálculo de `ids` ao salvar (substituir as referências a `modalidades` por `modalidadesAtivas` nesses três pontos).

- [ ] **Step 5: Build** — `cd frontend && npx tsc -b && npm run build` → sem erros.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/types/modalidade.ts frontend/src/services/modalidades.ts frontend/src/pages/competicoes/ModalidadesPanel.tsx frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx
git commit -m "feat(ui): ativar/desativar modalidade na competição"
```

---

## Task 5: Status "Suspenso" — enum + migration + tipos/labels/form

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260612000100_add_status_suspenso/migration.sql`
- Modify: `frontend/src/types/evento.ts`
- Modify: `frontend/src/lib/evento-status.ts`
- Modify: `frontend/src/pages/eventos/EventoForm.tsx`

- [ ] **Step 1: Enum no schema** — em `backend/prisma/schema.prisma`, no `enum EventoStatus { ... }`, adicionar `suspenso` após `parcial`:
```prisma
enum EventoStatus {
  rascunho
  inscricoes
  pronto
  sorteado
  parcial
  suspenso
}
```

- [ ] **Step 2: Migration** — criar `backend/prisma/migrations/20260612000100_add_status_suspenso/migration.sql`:
```sql
ALTER TYPE "EventoStatus" ADD VALUE 'suspenso';
```

- [ ] **Step 3: Generate + build** — `cd backend && npx prisma generate` → ok. `cd backend && npx prisma validate` → valid. `cd backend && npm run build` → tsc limpo.

- [ ] **Step 4: Frontend tipo** — em `frontend/src/types/evento.ts`, trocar:
```ts
export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial'
```
por:
```ts
export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial' | 'suspenso'
```

- [ ] **Step 5: Labels/cores** — em `frontend/src/lib/evento-status.ts`, adicionar as entradas `suspenso`:
em `STATUS_LABEL`, após `parcial: 'Parcial',`:
```ts
  suspenso: 'Suspenso',
```
em `STATUS_COLOR`, após a linha do `parcial`:
```ts
  suspenso: 'bg-[var(--warn-soft)] text-[var(--warn-700)] border border-[var(--warn)]',
```

- [ ] **Step 6: Form** — em `frontend/src/pages/eventos/EventoForm.tsx`:
trocar `const STATUS_VALUES: EventoStatus[] = ['rascunho', 'inscricoes', 'pronto', 'sorteado', 'parcial']` por:
```ts
const STATUS_VALUES: EventoStatus[] = ['rascunho', 'inscricoes', 'pronto', 'sorteado', 'parcial', 'suspenso']
```
em `STATUS_DESC`, adicionar:
```ts
  suspenso: 'Evento pausado — ações bloqueadas até reativar.',
```

- [ ] **Step 7: Build frontend** — `cd frontend && npx tsc -b && npm run build` → sem erros.

- [ ] **Step 8: Commit**
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260612000100_add_status_suspenso frontend/src/types/evento.ts frontend/src/lib/evento-status.ts frontend/src/pages/eventos/EventoForm.tsx
git commit -m "feat(eventos): status Suspenso (enum + label/cor + opção no form)"
```

---

## Task 6: Backend — bloquear sorteio de evento suspenso

**Files:**
- Modify: `backend/src/modules/sorteios/sorteios.service.ts`
- Test: `backend/src/modules/sorteios/sorteios.service.test.ts`

- [ ] **Step 1: Teste** — em `backend/src/modules/sorteios/sorteios.service.test.ts`, adicionar:
```ts
  it('executar bloqueia evento suspenso', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 5, competicao_id: 1, anfitriao_id: null, status: 'suspenso', competicao: { considerar_anfitriao: false } })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, chave_versao: 'V1', tipo_modalidade: { tipo: 'ordem_entrada' } })
    await expect(service.executar({ evento_id: 5, modalidade_id: 2 })).rejects.toMatchObject({ status: 400 })
  })
```
Run: `cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts` → FAIL.

- [ ] **Step 2: Implementar** — em `backend/src/modules/sorteios/sorteios.service.ts`, em `executar`:
(a) no `select` do `prisma.evento.findUnique`, adicionar `status: true` (junto de `id`, `competicao_id`, `anfitriao_id`, `competicao`).
(b) logo após a checagem `if (!modalidade) throw ...` e a checagem de competição, adicionar:
```ts
  if ((evento as any).status === 'suspenso') {
    throw Object.assign(new Error('Evento suspenso — reative o evento para sortear.'), { status: 400 })
  }
```
Run o teste → PASS. Rodar a suíte de sorteios inteira: `cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts` → todos verdes (os mocks de `evento.findUnique` dos outros testes não definem `status`, então `status === 'suspenso'` é falso — ok).

- [ ] **Step 3: Build** — `cd backend && npm run build` → tsc limpo.

- [ ] **Step 4: Commit**
```bash
git add backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.service.test.ts
git commit -m "feat(sorteios): bloquear sorteio de evento suspenso (400)"
```

---

## Task 7: Frontend — card âmbar + bloqueio de ações no evento suspenso

**Files:**
- Modify: `frontend/src/pages/eventos/EventosList.tsx`
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

- [ ] **Step 1: EventosList — fundo âmbar** — em `frontend/src/pages/eventos/EventosList.tsx`, dentro do `.map` que renderiza cada card (onde hoje há `const ribbonGrad = ...` antes do `return (`), adicionar:
```tsx
                        const suspenso = ev.status === 'suspenso'
```
No `<div key={ev.id} ... style={{ ... background: 'var(--card-bg)', border: '1px solid var(--card-border)', ... }}>`, trocar essas duas props por condicionais:
```tsx
                              background: suspenso ? 'var(--warn-soft)' : 'var(--card-bg)',
                              border: suspenso ? '1px solid var(--warn)' : '1px solid var(--card-border)',
```
E nos handlers de hover, ajustar o restore de borderColor para respeitar o suspenso:
- no `onMouseEnter`: manter `'var(--brand-400)'` (hover destaca normalmente).
- no `onMouseLeave`: trocar `e.currentTarget.style.borderColor = 'var(--card-border)'` por:
```tsx
                              e.currentTarget.style.borderColor = suspenso ? 'var(--warn)' : 'var(--card-border)'
```

- [ ] **Step 2: EventoInscricoes — aviso + desabilitar ações** — em `frontend/src/pages/eventos/EventoInscricoes.tsx`:
(a) logo após obter `evento` (ex.: após `const camposSubtitulo = ...` ou junto às derivações do topo do componente), adicionar:
```tsx
  const eventoSuspenso = evento?.status === 'suspenso'
```
(b) no banner do evento (a `<div>` de progresso, perto de "Editar evento"), quando suspenso, mostrar um aviso. Inserir logo após a abertura do bloco do banner (dentro do card do evento):
```tsx
            {eventoSuspenso && (
              <div style={{ width: '100%', padding: '10px 14px', background: 'var(--warn-soft)', border: '1px solid var(--warn)', borderRadius: 'var(--radius-lg)', color: 'var(--warn-700)', fontSize: 13, fontWeight: 600 }}>
                Evento suspenso — ações bloqueadas. Reative no formulário do evento (“Editar evento”) para liberar.
              </div>
            )}
```
(c) desabilitar os botões operacionais somando `|| eventoSuspenso` à prop `disabled` (ou adicionando `disabled={eventoSuspenso}` quando não houver) destes botões:
   - "Realizar sorteio" (`handleSortear`) e "Re-sortear" (`handleResortear`);
   - "Inscrever" (abre modal de inscrição);
   - "Importar CSV" (inscritos) e "Importar CSV" (campeões);
   - "Remover todos" (inscritos) e o "Remover todos os sorteios" do banner;
   - os botões de remover inscrição/sorteio individuais podem permanecer, mas as ações de criação (Inscrever/Importar/Sortear) DEVEM ficar desabilitadas.
   Para cada um, garantir `disabled={... || eventoSuspenso}` e `style`/classe com `opacity` reduzida quando desabilitado (seguir o padrão já usado nos botões com `disabled`). Ler o arquivo e aplicar em cada botão citado.

- [ ] **Step 3: Build** — `cd frontend && npx tsc -b && npm run build` → sem erros.

- [ ] **Step 4: Verificação manual**
`cd frontend && npm run dev` (backend rodando, migrations aplicadas):
- Marcar um evento como **Suspenso** no formulário → na lista, o card fica **âmbar**.
- Abrir o evento suspenso → aviso no topo; botões de sortear/inscrever/importar/remover desabilitados; tentar sortear via API retorna 400.
- Reativar (mudar status) → tudo destrava.
- Desativar uma modalidade na competição → some dos eventos (sidebar, contador, Congresso, Painel, mobile); reativar → volta com inscritos/sorteios.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/eventos/EventosList.tsx frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(ui): card âmbar e bloqueio de ações para evento suspenso"
```

---

## Self-review (cobertura das specs)

**Modalidade ativa:**
- Campo `ativa` + migration → Task 1 ✓
- Endpoint `PATCH /:id/ativa` + service `setAtiva` → Task 2 ✓
- Filtro `ativa=true` em modalidadesDoEvento, eventos.listar (contadores), key-access, site-publico, relatório → Task 3 ✓
- Toggle na gestão (esmaecer + selo + confirmar desativar) + painel per-evento só ativas + tipo/serviço → Task 4 ✓
- `GET /modalidades?competicao_id` inalterado (gestão vê todas) ✓

**Status Suspenso:**
- Enum `suspenso` + migration → Task 5 ✓
- Tipo/label/cor âmbar + opção no form → Task 5 ✓
- Guardrail server-side no sorteio (400) → Task 6 ✓
- Card âmbar na lista + aviso e bloqueio de ações no evento → Task 7 ✓
- Painel já exclui suspenso (ATIVOS_STATUS) — sem mudança ✓; Modo Congresso/site público já excluem por status ✓

- Duas migrations (exigem Cloud SQL prod ligado no deploy-main). Validação por testes (mock prisma) + `npm run build` + manual.
