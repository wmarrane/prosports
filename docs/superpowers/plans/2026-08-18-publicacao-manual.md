# Evento com publicação manual no site público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Um parâmetro no evento que desliga toda publicação automática no site público — publicar por status, despublicar por status e republicar ao mexer em boletim. Com ele ligado, o site só muda pelos botões Publicar / Publicar parcial / Despublicar.

**Architecture:** A trava mora dentro de `publicar`/`despublicar` (ponto único), não nos chamadores. As duas funções passam a receber a origem da chamada; quando a origem é automática e o evento tem `publicacao_manual`, retornam sem efeito. O default de `origem` é `'automatica'`, para que um chamador novo que esqueça de informar erre para o lado seguro.

**Tech Stack:** Prisma/Postgres, Express, Zod, Vitest (mock de prisma); React + Vite.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos; git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`); nunca `git add -A`.
- Backend: `cd backend && npx tsc --noEmit && npx vitest run <módulos tocados>`. Frontend: `cd frontend && npm run build`.
- Migration **aditiva** com default `false` — eventos existentes mantêm o comportamento atual. Nenhuma alteração de comportamento para evento sem o parâmetro.
- Publicar continua exigindo status `sorteado`/parcial; o parâmetro não afeta essa validação.
- Design: `docs/superpowers/specs/2026-08-18-publicacao-manual-design.md`.

---

### Task 1: Schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Evento`)
- Create: `backend/prisma/migrations/20260818120000_evento_publicacao_manual/migration.sql`

**Interfaces:**
- Produces: campo `Evento.publicacao_manual: boolean` (default `false`), disponível no Prisma Client.

- [ ] **Step 1: Acrescentar o campo ao schema** — em `backend/prisma/schema.prisma`, no model `Evento`, logo abaixo de `site_publicado_em`:

```prisma
  /// Quando true, o site público deste evento só muda por ação manual do admin.
  publicacao_manual Boolean   @default(false)
```

- [ ] **Step 2: Criar a migration** — `backend/prisma/migrations/20260818120000_evento_publicacao_manual/migration.sql`:

```sql
-- Evento com publicação manual: desliga publicar/despublicar por status e a
-- republicação ao mexer em boletim. Default false preserva o comportamento atual.
ALTER TABLE "Evento" ADD COLUMN "publicacao_manual" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Aplicar e conferir** — `cd backend && npx prisma generate`, depois:

```bash
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local --project-directory . build backend
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local --project-directory . run --rm migrate
```

Esperado: `All migrations have been successfully applied.` O `build` é necessário porque o serviço `migrate` roda a partir da imagem — sem ele a migration nova não entra.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260818120000_evento_publicacao_manual
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(evento): campo publicacao_manual"
```

---

### Task 2: A trava em publicar/despublicar

**Files:**
- Modify: `backend/src/modules/site-publico/site-publico.service.ts`
- Test: `backend/src/modules/site-publico/site-publico.service.test.ts`

**Interfaces:**
- Produces:
  - `export type OrigemPublicacao = 'manual' | 'automatica'`
  - `publicar(eventoId: number, opts?: { permitirParcial?: boolean; origem?: OrigemPublicacao }): Promise<void>`
  - `despublicar(eventoId: number, opts?: { origem?: OrigemPublicacao }): Promise<void>`
- Consumes: `Evento.publicacao_manual` (Task 1).

- [ ] **Step 1: Escrever os testes que falham** — acrescentar ao fim de `site-publico.service.test.ts`. O `beforeEach` do arquivo já configura `mp.evento.findUnique` com um evento `status: 'sorteado'`; os casos abaixo sobrescrevem o mock quando precisam do parâmetro ligado.

```ts
const EVENTO_MANUAL = {
  id: 10, nome: 'Jogos', local: 'Gin', organizador: 'M',
  data_hora: new Date('2026-05-10T12:00:00Z'), anfitriao_id: null,
  competicao_id: 7, status: 'sorteado', publicacao_manual: true,
  competicao: { nome: 'Regionais', considerar_anfitriao: false, subtitulo_campos: [] },
  municipio: { nome: 'São Manuel' }, boletins: [],
}

describe('publicacao_manual bloqueia só o que é automático', () => {
  it('automática NÃO publica quando o evento é de publicação manual', async () => {
    mp.evento.findUnique.mockResolvedValue(EVENTO_MANUAL)
    await service.publicar(10, { origem: 'automatica' })
    expect(store.putSnapshot).not.toHaveBeenCalled()
    expect(store.dispatchBuild).not.toHaveBeenCalled()
    expect(mp.evento.update).not.toHaveBeenCalled()
  })

  it('origem omitida é tratada como automática', async () => {
    mp.evento.findUnique.mockResolvedValue(EVENTO_MANUAL)
    await service.publicar(10)
    expect(store.putSnapshot).not.toHaveBeenCalled()
  })

  it('manual publica mesmo com publicação manual ligada', async () => {
    mp.evento.findUnique.mockResolvedValue(EVENTO_MANUAL)
    await service.publicar(10, { origem: 'manual' })
    expect(store.putSnapshot).toHaveBeenCalled()
  })

  it('automática NÃO despublica quando o evento é de publicação manual', async () => {
    mp.evento.findUnique.mockResolvedValue({ id: 10, publicacao_manual: true })
    await service.despublicar(10, { origem: 'automatica' })
    expect(store.deleteSnapshot).not.toHaveBeenCalled()
    expect(mp.evento.update).not.toHaveBeenCalled()
  })

  it('manual despublica mesmo com publicação manual ligada', async () => {
    mp.evento.findUnique.mockResolvedValue({ id: 10, publicacao_manual: true })
    await service.despublicar(10, { origem: 'manual' })
    expect(store.deleteSnapshot).toHaveBeenCalledWith(10)
    expect(mp.evento.update).toHaveBeenCalled()
  })

  it('evento sem o parâmetro segue publicando pela via automática', async () => {
    await service.publicar(10, { origem: 'automatica' })
    expect(store.putSnapshot).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run src/modules/site-publico`

Esperado: FALHAM os casos com `publicacao_manual: true` — hoje o service ignora o campo e publica/despublica assim mesmo.

- [ ] **Step 3: Implementar em `site-publico.service.ts`** — no topo do arquivo, se ainda não houver logger, acrescentar (mesmo padrão de `boletins.service.ts`):

```ts
import pino from 'pino'

const logger = pino()
```

Acrescentar o tipo exportado:

```ts
/** De onde veio a chamada: 'manual' = botão do admin; 'automatica' = gatilho do sistema. */
export type OrigemPublicacao = 'manual' | 'automatica'
```

Trocar a assinatura de `publicar` e incluir `publicacao_manual: true` no `select` do `findUnique`:

```ts
export async function publicar(
  eventoId: number,
  opts: { permitirParcial?: boolean; origem?: OrigemPublicacao } = {},
): Promise<void> {
```

Logo depois do `if (!evento) throw ...`, inserir o guard:

```ts
  // Evento de publicação manual não reage a gatilho automático. Não é erro: é o
  // comportamento pedido, então sai em silêncio.
  if ((opts.origem ?? 'automatica') === 'automatica' && evento.publicacao_manual) {
    logger.debug({ eventoId }, 'publicacao automatica ignorada: evento com publicacao_manual')
    return
  }
```

Reescrever `despublicar`:

```ts
export async function despublicar(
  eventoId: number,
  opts: { origem?: OrigemPublicacao } = {},
): Promise<void> {
  if ((opts.origem ?? 'automatica') === 'automatica') {
    const evento = await prisma.evento.findUnique({
      where: { id: eventoId },
      select: { publicacao_manual: true },
    })
    if (evento?.publicacao_manual) {
      logger.debug({ eventoId }, 'despublicacao automatica ignorada: evento com publicacao_manual')
      return
    }
  }
  await deleteSnapshot(eventoId)
  await dispatchBuild()
  await prisma.evento.update({ where: { id: eventoId }, data: { site_publicado_em: null } })
}
```

- [ ] **Step 4: Rodar e ver passar** — `cd backend && npx tsc --noEmit && npx vitest run src/modules/site-publico`

Esperado: todos verdes, inclusive os testes que já existiam no arquivo.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/site-publico/site-publico.service.ts backend/src/modules/site-publico/site-publico.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): publicar/despublicar ignoram gatilho automatico em evento manual"
```

---

### Task 3: Chamadores informam a origem

**Files:**
- Modify: `backend/src/modules/site-publico/site-publico.controller.ts` (3 handlers)
- Modify: `backend/src/modules/eventos/eventos.service.ts:201-205`
- Modify: `backend/src/modules/boletins/boletins.service.ts` (`republicarSePublicado`)

**Interfaces:**
- Consumes: `publicar`/`despublicar` com `origem` (Task 2).

- [ ] **Step 1: Controller passa `'manual'`** — em `site-publico.controller.ts`, nas três chamadas:

```ts
    await service.publicar(id, { permitirParcial, origem: 'manual' })
```

```ts
    await service.publicar(id, { permitirParcial: true, origem: 'manual' })
```

```ts
    await service.despublicar(id, { origem: 'manual' })
```

- [ ] **Step 2: `eventos.service.editar` passa `'automatica'`** — no bloco que usa `decidirAcaoPublicacao`:

```ts
  if (acao === 'publicar') {
    try { await publicar(id, { permitirParcial: true, origem: 'automatica' }) } catch (e) { console.warn(`[editar] publicar evento ${id} falhou`, e) }
  } else if (acao === 'despublicar') {
    try { await despublicar(id, { origem: 'automatica' }) } catch (e) { console.warn(`[editar] despublicar evento ${id} falhou`, e) }
  }
```

- [ ] **Step 3: `boletins.service.republicarSePublicado` passa `'automatica'`**:

```ts
    if (ev?.site_publicado_em) await publicar(eventoId, { origem: 'automatica' })
```

- [ ] **Step 4: Verificar** — `cd backend && npx tsc --noEmit && npx vitest run src/modules/site-publico src/modules/eventos src/modules/boletins`

Esperado: verdes. Os testes de boletins mockam `publicar`, então seguem passando — muda apenas o argumento da chamada.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/site-publico/site-publico.controller.ts backend/src/modules/eventos/eventos.service.ts backend/src/modules/boletins/boletins.service.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): chamadores informam a origem da publicacao"
```

---

### Task 4: API aceita o campo

**Files:**
- Modify: `backend/src/modules/eventos/eventos.controller.ts` (`createSchema`, linhas 11-23)

**Interfaces:**
- Produces: `POST /eventos` e `PATCH /eventos/:id` aceitam `publicacao_manual: boolean`.

- [ ] **Step 1: Acrescentar ao schema Zod** — em `createSchema`, depois de `data_fim`:

```ts
  publicacao_manual: z.boolean().optional(),
```

`updateSchema` é `createSchema.partial()`, então herda o campo automaticamente.

- [ ] **Step 2: Verificar** — `cd backend && npx tsc --noEmit && npx vitest run src/modules/eventos`

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/eventos/eventos.controller.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): API aceita publicacao_manual"
```

---

### Task 5: Checkbox no editor de evento

**Files:**
- Modify: `frontend/src/pages/eventos/EventoForm.tsx`

**Interfaces:**
- Consumes: campo `publicacao_manual` aceito pela API (Task 4).

- [ ] **Step 1: Ler** `EventoForm.tsx` — localizar os `useState` do formulário, o preenchimento a partir de `existing` (perto de `setLogoUrl(existing.logo_url ?? null)`, linha ~148), a montagem do `payload` (linhas ~231-243) e o bloco que já usa `type="checkbox"` (linha ~484), que serve de modelo de estilo.

- [ ] **Step 2: Estado** — junto aos demais `useState`:

```tsx
  const [publicacaoManual, setPublicacaoManual] = useState(false)
```

- [ ] **Step 3: Preencher ao editar** — na mesma função que faz `setLogoUrl(existing.logo_url ?? null)`:

```tsx
      setPublicacaoManual(existing.publicacao_manual === true)
```

- [ ] **Step 4: Enviar no payload** — em `const payload = { ... }`, depois de `data_fim`:

```tsx
        publicacao_manual: publicacaoManual,
```

- [ ] **Step 5: Render do checkbox** — na seção de configurações do evento:

```tsx
              <label className="flex items-start gap-2 text-sm text-[var(--t2)]" style={{ marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={publicacaoManual}
                  onChange={(e) => setPublicacaoManual(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  Publicação manual
                  <span className="block text-xs text-[var(--t3)]">
                    Este evento não é publicado nem atualizado automaticamente no site público.
                    Use os botões Publicar e Despublicar.
                  </span>
                </span>
              </label>
```

- [ ] **Step 6: Verificar** — `cd frontend && npm run build`

Esperado: `tsc -b && vite build` verdes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/eventos/EventoForm.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): checkbox de publicacao manual no editor"
```

---

## Verificação final (após as tasks)

- [ ] `cd backend && npx tsc --noEmit && npx vitest run` e `cd frontend && npm run build` verdes.
- [ ] **Ponta a ponta no ambiente local** (rodar `npm run dev:update` antes), num evento de teste com o parâmetro **ligado**:
  - mudar o status para `sorteado` → **não** publica (conferir `site_publicado_em` nulo no banco e ausência do snapshot em `/data/snapshots`);
  - publicar pelo botão → publica;
  - voltar o status para `rascunho` → **continua** no ar;
  - adicionar um boletim → o snapshot **não** é regravado (conferir o `mtime` do arquivo);
  - despublicar pelo botão → sai do ar.
- [ ] **Regressão**, num evento com o parâmetro **desligado**: mudar para `sorteado` publica; voltar para `rascunho` despublica; boletim republica.

## Self-Review (cobertura da spec)

- Campo no evento, default false, migration aditiva: Task 1 ✓
- Trava dentro de publicar/despublicar, silenciosa, com `origem` default `'automatica'`: Task 2 ✓
- Os três gatilhos automáticos cobertos (status publica, status despublica, boletim republica): Task 2 (a trava) + Task 3 (origem nos chamadores) ✓
- Endpoints manuais seguem funcionando: Task 3 (`origem: 'manual'`) + testes da Task 2 ✓
- Checkbox no editor: Task 5 ✓
- Publicar continua exigindo status sorteado/parcial: nenhuma task mexe nessa validação ✓
- Fora de escopo (aviso de "há alterações não publicadas"): nenhuma task o implementa ✓
