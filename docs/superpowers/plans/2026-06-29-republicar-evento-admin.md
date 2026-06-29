# Ação "Republicar" no admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Republicar" no card de evento do admin que sobrescreve o snapshot publicado (qualquer evento já publicado), sem despublicar antes.

**Architecture:** Frontend-only. Reusa o endpoint existente `publicar-parcial` (aceita pronto/parcial/sorteado; mesmo snapshot do `publicar`). Novo botão no `EventoAdminCard` (ramo já-publicado) ligado a uma nova mutation `republicarSite` na `EventosList`.

**Tech Stack:** React + TypeScript, @tanstack/react-query, Vitest (`renderToStaticMarkup`). Build admin: `tsc -b && vite build` (`npm run build`).

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`.
- Nunca `git add -A` — adicionar só os arquivos da task.
- Validar com `cd frontend && npm run build` (tsc -b + vite) e `npx vitest run src/pages/eventos/EventoAdminCard.test.tsx`.
- Sem cores novas; reusar classes/estilos do card. Sem mudança no backend.
- Demo no dev antes do merge na develop; produção só com confirmação do Wagner.

---

### Task 1: Botão "Republicar" + wiring

**Files:**
- Modify: `frontend/src/pages/eventos/EventoAdminCard.tsx`
- Modify: `frontend/src/pages/eventos/EventosList.tsx`
- Test: `frontend/src/pages/eventos/EventoAdminCard.test.tsx`

**Interfaces:**
- Consome: `eventosService.publicarParcial(id)` (já existe em `frontend/src/services/eventos.ts`).
- Produz: prop `onRepublicar: (id: number) => void` e `republicando: boolean` no `EventoAdminCard`.

- [ ] **Step 1: Atualizar o teste (falha primeiro)**

Em `frontend/src/pages/eventos/EventoAdminCard.test.tsx`:

a) Trocar a linha do `cbs` para incluir os novos callbacks/flag:
```tsx
const cbs = { isAdmin: true, publicando: false, despublicando: false, republicando: false, onAbrir: noop, onInscricoes: noop, onPublicar: noop, onDespublicar: noop, onRepublicar: noop, onRemover: noop }
```

b) No teste `'mostra Despublicar quando publicado'`, acrescentar a asserção de Republicar:
```tsx
it('mostra Despublicar e Republicar quando publicado', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev({ site_publicado_em: '2026-06-19T00:00:00Z' })} {...cbs} />)
  expect(html).toContain('Despublicar')
  expect(html).toContain('Republicar')
  expect(html).not.toContain('Publicar no site')
})
```

c) Adicionar um teste novo (não publicado → sem Republicar):
```tsx
it('não mostra Republicar quando não publicado', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev()} {...cbs} />)
  expect(html).not.toContain('Republicar')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/eventos/EventoAdminCard.test.tsx`
Expected: FAIL (prop `onRepublicar`/`republicando` ainda não existem; "Republicar" não renderizado).

- [ ] **Step 3: Implementar no `EventoAdminCard.tsx`**

a) No tipo de props (`EventoAdminCardProps`), adicionar após `despublicando: boolean`:
```tsx
  republicando: boolean
```
e adicionar após `onPublicar: (id: number) => void`:
```tsx
  onRepublicar: (id: number) => void
```

b) Na desestruturação dos parâmetros do componente, incluir `republicando` e `onRepublicar`:
```tsx
export default function EventoAdminCard({
  evento: ev, publicando, despublicando, republicando,
  onAbrir, onInscricoes, onPublicar, onDespublicar, onRepublicar, onRemover,
}: EventoAdminCardProps) {
```

c) No ramo já-publicado, inserir o botão "Republicar" **antes** do "Despublicar". Trocar:
```tsx
          {ev.site_publicado_em ? (
            <button
              onClick={e => { stop(e); onDespublicar(ev.id) }}
              disabled={despublicando}
              title="Remove o evento do site público (~1–2 min). Re-publicar atualiza/sobrescreve o snapshot."
              className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
            >Despublicar</button>
          ) : (
```
por:
```tsx
          {ev.site_publicado_em ? (
            <>
              <button
                onClick={e => { stop(e); onRepublicar(ev.id) }}
                disabled={republicando}
                title="Atualiza/sobrescreve o snapshot publicado com o estado atual do evento (~1–2 min)."
                className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >Republicar</button>
              <button
                onClick={e => { stop(e); onDespublicar(ev.id) }}
                disabled={despublicando}
                title="Remove o evento do site público (~1–2 min). Re-publicar atualiza/sobrescreve o snapshot."
                className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
              >Despublicar</button>
            </>
          ) : (
```

- [ ] **Step 4: Implementar no `EventosList.tsx`**

a) Após a mutation `despublicarSite`, adicionar:
```tsx
  const { mutate: republicarSite, isPending: republicandoSite } = useMutation({
    mutationFn: (id: number) => eventosService.publicarParcial(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eventos'] }); toast.success('Republicação disparada. O site público será atualizado em ~1-2 min.') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao republicar.'),
  })
```

b) No uso do `<EventoAdminCard ... />`, adicionar as duas props (junto às demais `publicando`/`onPublicar`):
```tsx
                      republicando={republicandoSite}
                      onRepublicar={id => republicarSite(id)}
```

- [ ] **Step 5: Rodar testes + build**

Run: `cd frontend && npx vitest run src/pages/eventos/EventoAdminCard.test.tsx && npm run build`
Expected: testes PASS; build (tsc -b + vite) sem erros.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/pages/eventos/EventoAdminCard.tsx frontend/src/pages/eventos/EventosList.tsx frontend/src/pages/eventos/EventoAdminCard.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos-admin): botao Republicar (sobrescreve publicacao via publicar-parcial)"
```

---

## Verificação final (após a task)

- [ ] `cd frontend && npx vitest run src/pages/eventos/EventoAdminCard.test.tsx && npm run build` verdes.
- [ ] **Demo no dev:** num evento publicado, alterar algo (ex.: status → Sorteado), clicar **Republicar**, confirmar no site público de dev que o snapshot/badge atualizou (~1–2 min) sem ter despublicado. (Telas do admin não são SSG — validar ao vivo no dev após o merge.)
- [ ] Após aprovação: merge `feat/<branch>` → develop (só arquivos esperados), push, monitorar deploy.

## Self-Review (cobertura da spec)
- Botão Republicar no ramo publicado, ao lado do Despublicar: Step 3 ✓.
- Reusa `publicar-parcial` (qualquer evento publicado): Step 4 ✓.
- Sem modal; toast; disabled enquanto pendente: Steps 3–4 ✓.
- "Publicar no site" (não publicado) inalterado: Step 3 mantém o ramo `else` ✓.
- Testes presença/ausência de "Republicar": Step 1 ✓.
- Sem backend; sem cores novas (classe brand já usada): ✓.
