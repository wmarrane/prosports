# Reiniciar evento (botão único, sempre visível) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reusar o botão "Apagar sorteios" de `EventoInscricoes`: deixá-lo sempre visível, renomeá-lo para "Reiniciar evento", e (a lógica de `clearVistas` no `onSuccess` já existe) fazê-lo apagar sorteios + reiniciar as apresentações do Modo Congresso, com cópia de modal clara.

**Architecture:** Frontend-only, um único arquivo (`EventoInscricoes.tsx`). Sem mudança de lógica/mutation — apenas visibilidade do botão, rótulo, ícone e textos do modal (confirmação e resumo) tornados condicionais a `sorteadas`/`count`.

**Tech Stack:** React 18, TypeScript, Vite. Ícone `RotateCcw` (lucide-react).

**Validação obrigatória:** `npm run build` (`tsc -b && vite build`) + `npm run test` (regressão) em `C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend`. Esta tela não tem teste unitário (convenção do repo) — verificação por build + manual.

**Spec:** `docs/superpowers/specs/2026-06-13-reiniciar-apresentacao-congresso-design.md`

**Git:** identidade NÃO configurada — commitar inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure

- **Modify** `frontend/src/pages/eventos/EventoInscricoes.tsx` — import `RotateCcw`; botão sempre visível + rótulo/ícone; cópia do modal (confirmação e resumo) condicional.

(Nenhuma mudança em `ModoCongresso`/`CongressoStepModalidade`/helpers — o `onSuccess` do `apagarTodosSorteios` já chama `clearVistas`.)

---

## Task 1: Botão "Reiniciar evento" sempre visível + cópia do modal

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

- [ ] **Step 1: Importar `RotateCcw`**

Na linha 27, trocar:
```ts
import { Brackets, Group, ListOrdered, FileText, Users, Crown, Download, Calendar, MapPin, Home, Trash2 } from 'lucide-react'
```
Por:
```ts
import { Brackets, Group, ListOrdered, FileText, Users, Crown, Download, Calendar, MapPin, Home, Trash2, RotateCcw } from 'lucide-react'
```
(`Trash2` permanece — é usado em outros pontos.)

- [ ] **Step 2: Botão sempre visível + rótulo/ícone**

Trocar o bloco (linhas ~469-479):
```tsx
              {sorteadas > 0 && (
                <button
                  onClick={() => { setApagarTodosOpen(true); setApagarTodosResumo(null) }}
                  disabled={eventoSuspenso}
                  className="text-xs hover:text-[var(--danger-700)] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title="Apagar todos os sorteios deste evento"
                >
                  <Trash2 size={12} /> Apagar sorteios
                </button>
              )}
```
Por:
```tsx
              <button
                onClick={() => { setApagarTodosOpen(true); setApagarTodosResumo(null) }}
                disabled={eventoSuspenso}
                className="text-xs hover:text-[var(--danger-700)] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title="Apagar sorteios (se houver) e reiniciar as apresentações do Modo Congresso"
              >
                <RotateCcw size={12} /> Reiniciar evento
              </button>
```
(Removida a condição `sorteadas > 0` → sempre visível; mantém `disabled={eventoSuspenso}`.)

- [ ] **Step 3: Modal — estado de confirmação (ícone, título, descrição, botão)**

Trocar o ícone do círculo (linha ~1393):
```tsx
                  <Trash2 size={36} />
```
Por:
```tsx
                  <RotateCcw size={36} />
```

Trocar o título (linhas ~1395-1397):
```tsx
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>
                  Apagar todos os sorteios?
                </h3>
```
Por:
```tsx
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>
                  Reiniciar evento?
                </h3>
```

Trocar a descrição (linhas ~1398-1400):
```tsx
                <p style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 24 }}>
                  Os <b style={{ color: 'var(--t1)' }}>{sorteadas}</b> {sorteadas === 1 ? 'sorteio' : 'sorteios'} de <b style={{ color: 'var(--t1)' }}>{evento?.nome}</b> serão apagados. As inscrições e campeões anteriores permanecem. Esta ação não pode ser desfeita.
                </p>
```
Por:
```tsx
                <p style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 24 }}>
                  {sorteadas > 0 ? (
                    <>Os <b style={{ color: 'var(--t1)' }}>{sorteadas}</b> {sorteadas === 1 ? 'sorteio' : 'sorteios'} de <b style={{ color: 'var(--t1)' }}>{evento?.nome}</b> serão apagados e as apresentações do Modo Congresso serão reiniciadas. As inscrições e campeões anteriores permanecem. Esta ação não pode ser desfeita.</>
                  ) : (
                    <>As apresentações do Modo Congresso de <b style={{ color: 'var(--t1)' }}>{evento?.nome}</b> serão reiniciadas. Inscrições, campeões e sorteios não são afetados.</>
                  )}
                </p>
```

Trocar o botão de confirmação (linha ~1435):
```tsx
                  ><Trash2 size={16} /> {apagandoTodos ? 'Apagando...' : `Apagar ${sorteadas}`}</button>
```
Por:
```tsx
                  ><RotateCcw size={16} /> {apagandoTodos ? 'Reiniciando...' : 'Reiniciar'}</button>
```

- [ ] **Step 4: Modal — estado de resumo (título + descrição)**

Trocar o título (linhas ~1372-1374):
```tsx
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>
                  Sorteios apagados
                </h3>
```
Por:
```tsx
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>
                  Evento reiniciado
                </h3>
```

Trocar a descrição (linhas ~1375-1377):
```tsx
                <p style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 24 }}>
                  <b style={{ color: 'var(--t1)' }}>{apagarTodosResumo.count}</b> {apagarTodosResumo.count === 1 ? 'sorteio foi apagado' : 'sorteios foram apagados'}. Você pode realizar novos sorteios para cada modalidade.
                </p>
```
Por:
```tsx
                <p style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 24 }}>
                  {apagarTodosResumo.count > 0 ? (
                    <><b style={{ color: 'var(--t1)' }}>{apagarTodosResumo.count}</b> {apagarTodosResumo.count === 1 ? 'sorteio foi apagado' : 'sorteios foram apagados'} e as apresentações foram reiniciadas.</>
                  ) : (
                    <>Apresentações reiniciadas.</>
                  )}
                </p>
```

- [ ] **Step 5: Build + testes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS (`tsc -b && vite build`, sem erros; `RotateCcw` importado, `Trash2` ainda usado em outros pontos).

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS (suíte inteira — sem regressão).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): botao Reiniciar evento sempre visivel (apaga sorteios + reinicia apresentacoes)"
```

---

## Manual Test Checklist

`npm run dev` → abrir um evento em `EventoInscricoes`:

- O botão **"Reiniciar evento"** aparece **sempre** (mesmo sem sorteios), desabilitado se o evento estiver suspenso.
- **Com sorteios:** clicar → modal "Reiniciar evento?" cita os N sorteios + reinício das apresentações → "Reiniciar" → resumo "Evento reiniciado" com count; sorteios apagados; inscrições/campeões permanecem.
- **Sem sorteios (só apresentadas):** clicar → modal descreve só o reinício das apresentações → "Reiniciar" → resumo "Apresentações reiniciadas". Abrir o Modo Congresso do evento → começa limpo (sem checks de apresentada).
- Inscrições e campeões anteriores intactos nos dois casos.

---

## Self-Review

**1. Spec coverage:**
- Reusar o botão (sem botão novo, sem mudança no Modo Congresso) → Task 1 (só EventoInscricoes). ✓
- Sempre visível (remove `sorteadas > 0`) → Step 2. ✓
- Rótulo fixo "Reiniciar evento" + ícone RotateCcw → Steps 1-2. ✓
- Modal confirmação/resumo com cópia condicional a sorteadas/count → Steps 3-4. ✓
- Lógica inalterada (clearVistas já no onSuccess) → nenhuma edição de mutation. ✓
- Inscrições/campeões permanecem (texto deixa claro) → Step 3. ✓

**2. Placeholder scan:** Sem TBD/TODO; todos os blocos completos. ✓

**3. Type consistency:** `RotateCcw` adicionado ao import; `Trash2` mantido (usado em outros pontos). `sorteadas` e `apagarTodosResumo.count` são `number` (já no componente). Sem novos tipos. ✓
