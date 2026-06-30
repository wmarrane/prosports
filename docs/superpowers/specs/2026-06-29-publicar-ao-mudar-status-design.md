# Publicar/despublicar automático ao mudar o status do evento — Design

**Data:** 2026-06-29
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Quando o **status de um evento é alterado no admin**, refletir automaticamente no site público:
- Ao mudar para **"Pronto p/ sortear"** → publica o evento (primeira publicação).
- Ao mudar para **"Sorteado"** → publica de novo (nova publicação, sobrescreve o snapshot).
- Ao mudar para um status **não-público** (Rascunho, Inscrições, Suspenso) → despublica do site.

Hoje a publicação é manual (botões Publicar/Republicar) ou via auto-publish do Modo Congresso. Esta feature liga a publicação às transições de status, eliminando o passo manual.

Validar em **develop** antes de promover.

## Decisões aprovadas

- **Gatilho: só na mudança de status** (transição). Salvar o evento sem mudar o status **não** re-publica.
- **Mapa transição → ação** (quando o `status` vem no payload e é diferente do atual):
  - `pronto`, `parcial`, `sorteado` → **publicar** (`publicar(id, { permitirParcial: true })`). "Parcial" entra no grupo que **publica** (é um estado publicado do sorteio; despublicar nele seria contraditório).
  - `rascunho`, `inscricoes`, `suspenso` → **despublicar** (apenas se estiver publicado, para ser idempotente).
- **Approach A — no backend, dentro do `editar`.** Fonte única; vale para qualquer caminho que altere o status.
- **Best-effort:** publicar/despublicar roda em try/catch e **nunca derruba o salvamento do status**. Em falha, loga um aviso; o operador ainda tem o botão Republicar.
- Sem novo endpoint (reusa `publicar`/`despublicar` do `site-publico.service`).

## Contexto (codebase)

- `backend/src/modules/eventos/eventos.service.ts` → `editar(id, data)`: hoje faz `prisma.evento.update({ where:{id}, data: rest })` (+ comissão) e retorna o evento. **Não** lê o status anterior nem publica.
- `backend/src/modules/site-publico/site-publico.service.ts`:
  - `publicar(id, { permitirParcial })` — `permitirParcial:true` aceita `STATUS_PARCIAL_OK = ['pronto','parcial','sorteado']`; gera snapshot (`putSnapshot`) + `dispatchBuild` + seta `site_publicado_em`.
  - `despublicar(id)` — `deleteSnapshot` + `dispatchBuild` + seta `site_publicado_em = null`.
- Status válidos: `rascunho`, `inscricoes`, `pronto`, `sorteado`, `parcial`, `suspenso`.
- Import: `eventos.service` ainda não importa `site-publico.service`. `site-publico.service` importa `eventos/evento-modalidades.service` (não `eventos.service`), então não há ciclo direto; usar import estático e, se o bundler/ts acusar ciclo, trocar por import dinâmico (`await import(...)`).

## Arquitetura — Approach A

Em `editar(id, data)`:
1. **Antes** do update, ler o status atual: `const antes = await prisma.evento.findUnique({ where: { id }, select: { status: true } })`.
2. Aplicar o update existente (campos + comissão).
3. **Depois**, se `data.status` veio no payload **e** `data.status !== antes?.status`, executar a ação (best-effort, em try/catch que só loga em erro):
   - `PUBLICAVEIS = ['pronto','parcial','sorteado']` → `await publicar(id, { permitirParcial: true })`.
   - senão (`rascunho`/`inscricoes`/`suspenso`) → despublicar **apenas se publicado**: ler `site_publicado_em` (pode reusar a leitura do passo 1 incluindo o campo) e, se setado, `await despublicar(id)`.
4. Retornar o evento atualizado (igual a hoje).

Extrair a lógica em um helper interno testável, ex.: `async function sincronizarPublicacao(id, statusAntes, statusDepois, publicadoEm)`, para o teste poder exercitar o mapa sem depender do update.

## Erro / borda

- Falha de `publicar`/`despublicar` (GCS/build/etc.) **não** propaga: o `editar` retorna sucesso; loga `console.warn`/logger. (O operador percebe pelo site não atualizar e usa Republicar.)
- `status` ausente no payload (edição de outros campos) → nenhuma ação.
- `status` presente mas **igual** ao atual → nenhuma ação.
- Transição para `pronto`/`parcial`/`sorteado` sempre (re)publica, mesmo que já publicado (idempotente — sobrescreve o snapshot).

## Testes / Verificação

- **Backend unit (`eventos` service):** com `publicar`/`despublicar` do `site-publico.service` **mockados** (spy), verificar:
  - status muda para `sorteado` → `publicar(id,{permitirParcial:true})` chamado 1×; `despublicar` não.
  - status muda para `pronto` → `publicar` chamado.
  - status muda para `parcial` → `publicar` chamado (não despublicar).
  - status muda para `rascunho`/`suspenso` **estando publicado** → `despublicar` chamado.
  - status muda para `rascunho` **não publicado** → nenhuma ação.
  - `status` ausente ou igual ao atual → nenhuma das duas chamado.
  - Falha simulada em `publicar` → `editar` ainda resolve (não lança).
- `cd backend && npx vitest run` na suíte do módulo verde (nota: já existem ~6 falhas pré-existentes de timeout em storage/relatorio_congresso, não relacionadas).
- `cd frontend && npm run build` (sem mudança de tipos no front, mas garante nada quebrou) — opcional.
- **Demo no dev:** no admin, mudar um evento para "Pronto p/ sortear" → conferir que aparece publicado no site de dev (~1–2 min); mudar para "Sorteado" → conferir atualização; mudar para "Rascunho" → conferir que saiu do site.

## Fora de escopo
- Mudar o gatilho para "a cada salvamento" (ficou transição-only).
- Auto-publish do Modo Congresso (continua como está; coexiste).
- Botões manuais Publicar/Republicar/Despublicar (continuam).
- Notificar o operador no front sobre falha de publicação (v1 só loga no backend).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Nunca `git add -A`. Validar backend com `npx vitest run`. Sem mudança de schema/migration.
- Demo em develop antes de promover; produção só com confirmação do Wagner.
