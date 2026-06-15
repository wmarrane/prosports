# Site público: regras de "específico" e mínimo de inscritos — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Problema

No site público (SSG por snapshot), a página de evento (`EventoPage` → `ModalidadeSorteio`) mostra **"Aguardando sorteio"** para toda modalidade sem sorteio salvo. Isso é incorreto em dois casos que o admin já trata:

1. **Modalidades `especifico`:** não possuem sorteio automático. Mostrar "Aguardando sorteio" sugere que um sorteio virá — não virá.
2. **Modalidades sorteáveis abaixo do mínimo:** têm regras em `mensagens_inscritos` (`{ min, max, mensagem, pular_sorteio }`). Quando a regra que casa com o nº de inscritos tem `pular_sorteio: true`, a modalidade **não vai a sorteio** e a `mensagem` configurada deve ser exibida — em vez de "Aguardando sorteio".

O admin (`EventoInscricoes.tsx`) já aplica `matchMensagem`/`isSorteavel`; o site público é caminho separado e **não recebe `mensagens_inscritos`** no snapshot.

## Decisão

- Espelhar a semântica do admin no site público.
- O snapshot passa a carregar `mensagens_inscritos` por modalidade (o número de inscritos já está em `participantes`).
- Ajustar tanto o **corpo** do card (`ModalidadeSorteio`) quanto a **linha-resumo** (status no topo, em `EventoPage`).

## Contexto (estado atual)

- `frontend/src/site-publico/components/ModalidadeSorteio.tsx:19-21` — o bug: retorna "Aguardando sorteio" sempre que `status !== 'sorteado' || !resultado`.
- `frontend/src/site-publico/pages/EventoPage.tsx:32` — linha-resumo: `{m.tipo} · {m.participantes.length} inscritos · {m.status}`.
- `frontend/src/lib/mensagens-inscritos.ts` — `matchMensagem(regras, n)` e tipo `MensagemInscritos`. **Reutilizar.**
- Backend: `Modalidade.mensagens_inscritos` (JSON) existe; `backend/src/lib/sorteaveis.ts` já tem `matchMensagem`. O snapshot NÃO inclui esse campo hoje.
- `frontend/src/site-publico/snapshot-types.ts` e `backend/src/modules/site-publico/snapshot-types.ts` — `SnapModalidade` sem `mensagens_inscritos`.

## Mudanças

### Backend — incluir `mensagens_inscritos` no snapshot

**`backend/src/modules/site-publico/site-publico.service.ts`** (select das modalidades, ~linha 27):
```ts
select: { id: true, nome: true, tipo_modalidade: { select: { tipo: true } }, mensagens_inscritos: true },
```

**`backend/src/modules/site-publico/snapshot.ts`:**
- `ModalidadeRow` (linha 12) → adicionar `mensagens_inscritos: unknown`.
- No objeto retornado de `montaSnapshot` (linhas 83-95) → adicionar:
```ts
mensagens_inscritos: Array.isArray(mod.mensagens_inscritos) ? (mod.mensagens_inscritos as SnapModalidade['mensagens_inscritos']) : [],
```

**`backend/src/modules/site-publico/snapshot-types.ts`** — em `SnapModalidade` adicionar:
```ts
mensagens_inscritos: { min: number; max: number | null; mensagem: string; pular_sorteio: boolean }[]
```

### Frontend — tipos

**`frontend/src/site-publico/snapshot-types.ts`** — em `SnapModalidade` adicionar o mesmo campo. Importar e reutilizar o tipo de `../../lib/mensagens-inscritos`:
```ts
import type { MensagemInscritos } from '../../lib/mensagens-inscritos'
// ...
mensagens_inscritos: MensagemInscritos[]
```

### Frontend — corpo do card (`ModalidadeSorteio.tsx`)

Substituir o guard das linhas 19-21 por uma estrutura de 3 ramos (antes de montar os mapas):

```ts
import { matchMensagem } from '../../lib/mensagens-inscritos'
// ...
export default function ModalidadeSorteio({ modalidade }: { modalidade: SnapModalidade }) {
  if (modalidade.tipo === 'especifico') {
    return <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>Modalidade específica — não possui sorteio.</div>
  }
  if (modalidade.status !== 'sorteado' || !modalidade.resultado) {
    const regra = matchMensagem(modalidade.mensagens_inscritos ?? [], modalidade.participantes.length)
    return (
      <div style={{ padding: 16, color: 'var(--t3)', fontStyle: 'italic' }}>
        {regra?.mensagem && <p style={{ margin: '0 0 8px' }}>{regra.mensagem}</p>}
        {regra?.pular_sorteio ? 'Não vai a sorteio (regra de inscritos).' : 'Aguardando sorteio'}
      </div>
    )
  }
  // ... resto inalterado (buildMaps + render por tipo)
}
```

O ramo final `return <div ...>Emparceiramento específico</div>` (linha 62) torna-se inalcançável (específico tratado no topo) — **remover**.

### Frontend — linha-resumo (`EventoPage.tsx`)

Trocar `{m.status}` (linha 32) por uma palavra derivada:

```ts
function statusLabel(m: SnapModalidade): string {
  if (m.tipo === 'especifico') return 'específico'
  if (m.status === 'sorteado') return 'sorteado'
  const regra = matchMensagem(m.mensagens_inscritos ?? [], m.participantes.length)
  return regra?.pular_sorteio ? 'sem sorteio' : 'aguardando'
}
```

E no JSX: `<span className="mod-meta">{m.tipo} · {m.participantes.length} inscritos · {statusLabel(m)}</span>`.

## Tratamento de erros / casos

- `mensagens_inscritos` ausente/inválido → tratado como `[]` (sem regra casada → comportamento atual "Aguardando sorteio").
- Modalidade `sorteado` com resultado → inalterada (resultados renderizados como hoje).
- Nenhuma mudança de backend/migration (campo JSON já existe no modelo).

## Importante — efeito do snapshot

Site público é **estático**. As mudanças só aparecem na página publicada após **re-publicar** o evento (regera o snapshot com `mensagens_inscritos` e reflete a nova lógica). Snapshots antigos não têm o campo → degradam para "aguardando" até re-publicação.

## Testes

- Backend: `npm run build` + suíte existente (`montaSnapshot`). Adicionar/ajustar asserção de que `mensagens_inscritos` é propagado.
- Frontend: `npm run build` (`tsc -b && vite build`). Verificação manual após re-publicar: específico mostra "não possui sorteio"; abaixo do mínimo mostra a mensagem + "sem sorteio".

## Fora de escopo

- Mudar a contagem por modalidade (já correta) ou a contagem distinta por evento (corrigida em spec separada).
- Precomputar status/label no snapshot (mantém cálculo no render).
- Tooltip/estilização nova além do texto.
- Demais tipos de status ou outras telas do site público.
