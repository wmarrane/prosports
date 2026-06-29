# Ação "Republicar" no admin (sobrescreve a publicação atual) — Design

**Data:** 2026-06-29
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Adicionar uma ação **"Republicar"** no card de evento do admin (NewProsports) que **sobrescreve o snapshot publicado** com o estado atual do evento, **sem precisar despublicar antes**. Hoje, quando um evento está publicado, o card só oferece "Despublicar" — para refletir mudanças (ex.: status `pronto`→`sorteado`, novo boletim) é preciso despublicar e publicar de novo. O "Republicar" faz isso em um clique.

Validar em **develop** antes de promover.

## Decisões aprovadas

- **Abrangência:** Republicar funciona para **qualquer evento já publicado** (`site_publicado_em` setado), independente do status (`pronto`/`parcial`/`sorteado`).
- **Approach A — só frontend, reusa `publicar-parcial`.** Nenhuma mudança no backend. O endpoint `POST /eventos/:id/publicar-parcial` (`publicar(id,{permitirParcial:true})`) já aceita `pronto`/`parcial`/`sorteado` e gera **o mesmo snapshot** que o `publicar` (a única diferença entre os dois é o portão de status). Logo, Republicar chama `eventosService.publicarParcial(id)`.
- **Sem modal de confirmação** (consistente com o "Despublicar" atual). Feedback via toast; botão desabilitado enquanto pendente.
- Sem cores novas; segue os estilos/Tailwind já usados no card.

## Contexto (codebase)

- `frontend/src/pages/eventos/EventoAdminCard.tsx`: nas ações (~linha 153), `ev.site_publicado_em ? <Despublicar/> : <Publicar no site/>`. O "Publicar no site" é desabilitado salvo `status==='sorteado'`. Props atuais incluem `onPublicar`, `onDespublicar`, `publicando`, `despublicando`.
- `frontend/src/pages/eventos/EventosList.tsx`: tem `useMutation` `publicarSite` (`eventosService.publicar`) e `despublicarSite` (`eventosService.despublicar`), com toasts e invalidação; passa `onPublicar`/`onDespublicar` ao card.
- `frontend/src/services/eventos.ts`: já expõe `publicar`, `publicarParcial`, `despublicar`.
- Backend `publicar(id,{permitirParcial})` aceita `STATUS_PARCIAL_OK = ['pronto','parcial','sorteado']`; regenera o snapshot (`putSnapshot`) e dispara o build (`dispatchBuild`), atualizando `site_publicado_em`.
- Testes do card usam `renderToStaticMarkup` (presença de texto), ver `EventoAdminCard.test.tsx`.

## Componentes / mudanças

### `EventoAdminCard.tsx`
- Novas props: `onRepublicar: (id: number) => void` e `republicando?: boolean`.
- No ramo `ev.site_publicado_em` (já publicado), renderizar **dois** botões: primeiro **"Republicar"** (`onClick → onRepublicar(ev.id)`, `disabled={republicando}`), depois o **"Despublicar"** existente. Tooltip do Republicar: *"Atualiza/sobrescreve o snapshot publicado com o estado atual do evento (~1–2 min)."* Estilo: classe de link/botão equivalente ao "Publicar no site" (texto brand), seguindo o que já há no card.
- Ramo não publicado: inalterado ("Publicar no site").

### `EventosList.tsx`
- Nova mutation `republicarSite`: `mutationFn: (id) => eventosService.publicarParcial(id)`, `onSuccess` invalida a query de eventos + toast de sucesso ("Republicado no site."), `onError` toast com a mensagem do backend.
- Passar ao card: `onRepublicar={id => republicarSite(id)}` e `republicando={republicandoSite}`.

## Testes / Verificação

- **Unit (`EventoAdminCard.test.tsx`, estender):** atualizar o objeto de callbacks para incluir `onRepublicar: noop` (e `republicando: false`); quando `site_publicado_em` setado, o HTML contém **"Republicar"** e **"Despublicar"**; quando não publicado, **não** contém "Republicar".
- **Build admin:** `cd frontend && npm run build` (tsc -b + vite) sem erros — a nova prop obrigatória `onRepublicar` deve ser passada em todos os usos do card (só `EventosList`), senão o `tsc` falha (rede de segurança).
- **Testes:** `cd frontend && npx vitest run src/pages/eventos/EventoAdminCard.test.tsx` verde.
- **Demo no dev (antes de promover):** publicar um evento; alterar algo (ex.: status para Sorteado); clicar **Republicar**; confirmar no site público de dev que o snapshot/badge atualizou (~1–2 min) sem ter despublicado.

## Fora de escopo
- Mudança no backend (endpoints já existem).
- Modal de confirmação.
- Republicar em lote / múltiplos eventos de uma vez.
- Alterar a regra do "Publicar no site" (continua sorteado-only quando não publicado).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build` (admin) — o CI usa `tsc -b && vite build`; `tsc --noEmit` pode passar e o build falhar. Nunca `git add -A`.
- Reusar classes/estilos; sem cores novas. Validar em **develop** (demo) antes de promover; produção só com confirmação do Wagner.
