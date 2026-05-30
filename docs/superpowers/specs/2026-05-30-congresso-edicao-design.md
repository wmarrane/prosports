# Modo Congresso — Edição Inline de Inscritos e Campeões — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.16.1

## Objetivo

Habilitar adicionar/remover inscritos e campeões do ano anterior diretamente nos passos correspondentes do Modo Congresso (`/congresso`), sem precisar sair para `/eventos/:id/inscricoes`. Frontend-only — reusa endpoints e componentes existentes.

## Escopo

- **In:**
  - `CongressoStepParticipantes` ganha botão "+ Inscrever" (abre modal com `ParticipanteSelect`) e botão "×" por linha para remover (com `confirm()`).
  - `CongressoStepCampeoes` ganha botão "Editar campeões" que abre modal grande com 12 slots (CampeaoSlot reutilizado), permitindo cadastrar/remover.
  - Refactor: extrair `CampeaoSlot` (atualmente inline em `EventoInscricoes.tsx`) para `frontend/src/components/CampeaoSlot.tsx` para reuso nas 2 telas.
  - Modais estilizados para integrar com shell dark do Congresso (fundos escuros, z-index alto).
- **Out:**
  - Mudanças no backend (endpoints já existem).
  - Mudanças na tela `/eventos/:id/inscricoes` (continua igual, só consome o componente extraído).
  - Edição de outros recursos (sorteio, modalidade) no Congresso.

## UI — `CongressoStepParticipantes`

### Estado novo

```ts
const [inscreverOpen, setInscreverOpen] = useState(false)
const [pickedId, setPickedId] = useState<number | null>(null)
const [erroModal, setErroModal] = useState('')
const queryClient = useQueryClient()
```

### Mutations

```ts
const { mutate: criar, isPending: salvando } = useMutation({
  mutationFn: () => inscricoesService.criar({
    evento_id: eventoId, modalidade_id: modalidadeId, participante_id: pickedId!
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
    setInscreverOpen(false); setPickedId(null); setErroModal('')
  },
  onError: (err: any) => setErroModal(err?.response?.data?.message ?? 'Erro ao inscrever.'),
})

const { mutate: remover } = useMutation({
  mutationFn: (id: number) => inscricoesService.remover(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }),
  onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
})
```

### Mudanças no JSX

1. No header da seção (acima da lista), do lado direito do contador "X inscritos":
   - Adicionar botão "+ Inscrever" (mesmo style do "Próximo →" em escala menor).

2. Cada `<li>` da lista (que renderiza `i.participante.nome + subtitulo`) ganha um botão "×" à direita:
   ```tsx
   <li ...>
     <span>{i.participante.nome}{...subtitulo}</span>
     <button
       onClick={() => { if (confirm(`Remover ${i.participante.nome}?`)) remover(i.id) }}
       style={{ marginLeft: 'auto', color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20 }}
     >×</button>
   </li>
   ```
   Mudar `<li>` para `display: 'flex', alignItems: 'center'`.

3. Modal "Inscrever participante" (renderizar fora do main, em z-index 40):
   ```tsx
   {inscreverOpen && (
     <div style={{
       position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
       display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
     }} onClick={() => setInscreverOpen(false)}>
       <div style={{
         background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)',
         borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', margin: '0 16px',
       }} onClick={e => e.stopPropagation()}>
         <h3 style={{ fontSize: 20, fontWeight: 600, color: '#f1f5fb', marginBottom: 16 }}>
           Inscrever participante
         </h3>
         <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={inscricoes.map(i => i.participante_id)} />
         {erroModal && <p style={{ color: '#ef4444', fontSize: 14, marginTop: 12 }}>{erroModal}</p>}
         <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
           <button onClick={() => setInscreverOpen(false)} style={{ ...btnGhost }}>Cancelar</button>
           <button onClick={() => criar()} disabled={!pickedId || salvando} style={{ ...btnPrimary }}>
             {salvando ? 'Salvando...' : 'Confirmar'}
           </button>
         </div>
       </div>
     </div>
   )}
   ```

   Usar variáveis inline `btnGhost` e `btnPrimary` (definidas no topo do componente) para evitar repetição.

## UI — `CongressoStepCampeoes`

### Estado novo

```ts
const [editOpen, setEditOpen] = useState(false)
const queryClient = useQueryClient()
```

### Mutations

```ts
const { mutate: criarCampeao, isPending: salvandoCampeao } = useMutation({
  mutationFn: (data: { participante_id: number; posicao: number }) =>
    campeoesAnterioresService.criar({
      evento_id: eventoId, modalidade_id: modalidadeId,
      participante_id: data.participante_id, posicao: data.posicao,
    }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
  onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao salvar campeão.'),
})

const { mutate: removerCampeao } = useMutation({
  mutationFn: (cid: number) => campeoesAnterioresService.remover(cid),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
  onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover campeão.'),
})
```

### Mudanças no JSX

1. Botão "Editar campeões" antes do "Próximo →" no rodapé:
   ```tsx
   <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, gap: 12 }}>
     <button onClick={() => setEditOpen(true)} style={{ ...btnGhostOutline }}>
       Editar campeões
     </button>
     <button onClick={onNext} style={{ ...btnPrimary }}>Próximo →</button>
   </div>
   ```

2. Modal "Editar campeões do ano anterior" (z-index 40):
   ```tsx
   {editOpen && (
     <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', ..., zIndex: 40 }}
          onClick={() => setEditOpen(false)}>
       <div style={{
         background: '#0f1623', border: '1px solid rgba(255,255,255,0.1)',
         borderRadius: 16, padding: 24, maxWidth: 960, width: '100%', margin: '0 16px',
         maxHeight: '85vh', overflowY: 'auto',
       }} onClick={e => e.stopPropagation()}>
         <h3 style={{ fontSize: 20, fontWeight: 600, color: '#f1f5fb', marginBottom: 16 }}>
           Editar campeões do ano anterior
         </h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
           {POSICOES.map(pos => {
             const c = ordenados.find(x => x.posicao === pos) ?? null
             return (
               <CampeaoSlot
                 key={pos}
                 posicao={pos}
                 campeao={c}
                 excludeIds={ordenados.map(c => c.participante_id)}
                 onCriar={(participante_id) => criarCampeao({ participante_id, posicao: pos })}
                 onRemover={(cid) => removerCampeao(cid)}
                 salvando={salvandoCampeao}
               />
             )
           })}
         </div>
         <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
           <button onClick={() => setEditOpen(false)} style={{ ...btnPrimary }}>Fechar</button>
         </div>
       </div>
     </div>
   )}
   ```

3. Constante local `POSICOES = Array.from({length: 12}, (_, i) => i + 1)`.

## Refactor: Extrair `CampeaoSlot`

### `frontend/src/components/CampeaoSlot.tsx` (novo arquivo)

Copiar o sub-componente atual `function CampeaoSlot(...)` de `EventoInscricoes.tsx` para arquivo próprio. Manter assinatura idêntica:

```tsx
import { useState } from 'react'
import ParticipanteSelect from './ParticipanteSelect'
import CampeaoBadge from './CampeaoBadge'
import type { CampeaoAnterior } from '../types/campeao-anterior'

const POSICAO_LABEL = (n: number) => `${n}º lugar`

type Props = {
  posicao: number
  campeao: CampeaoAnterior | null
  excludeIds: number[]
  onCriar: (participante_id: number) => void
  onRemover: (id: number) => void
  salvando: boolean
}

export default function CampeaoSlot({ posicao, campeao, excludeIds, onCriar, onRemover, salvando }: Props) {
  const [pickedId, setPickedId] = useState<number | null>(null)
  // ...mesma implementação atual...
}
```

### `frontend/src/pages/eventos/EventoInscricoes.tsx`

- Remover declaração local de `CampeaoSlot` e `POSICAO_LABEL`/`posicaoLabel`.
- Importar: `import CampeaoSlot from '../../components/CampeaoSlot'`.
- Sem outras mudanças (comportamento idêntico).

### `frontend/src/pages/congresso/CongressoStepCampeoes.tsx`

- Importar `import CampeaoSlot from '../../components/CampeaoSlot'`.
- Adicionar `POSICOES = [1..12]` constante local.
- Usar no novo modal de edição.

## Release

- `package.json`: `1.16.0` → `1.16.1` (PATCH — feature aditiva pequena).
- `CHANGELOG.md`: bloco `[1.16.1]` com Added (edição inline no Congresso).

## Smoke pós-deploy

1. Login admin → /congresso → entrar evento+modalidade.
2. Passo 3 (Participantes): botão "+ Inscrever" no header da seção. Click → modal abre. Selecionar participante → Confirmar → linha aparece. Click "×" em outra linha → confirm → some.
3. Passo 4 (Campeões): botão "Editar campeões" no rodapé. Click → modal grande com 12 slots. Cadastrar campeão na posição 1 → "Salvar" → slot vira card preenchido. Remover → confirm → volta para input.
4. Passo 5 (Sorteio): se houver novos campeões cadastrados, re-sortear (Novo sorteio) deve usá-los como sementes (regra existente).
5. /eventos/:id/inscricoes continua funcionando igual com `CampeaoSlot` agora importado.
6. Rodapé sidebar: `v1.16.1`.

## Risco / efeitos colaterais

- **Apertar Cancelar do confirm()**: mutation não é chamada (comportamento padrão).
- **Modais sobrepondo shell dark**: z-index 40 cobre header do CongressoShell (z auto). Click no overlay fecha modal.
- **Cache compartilhado**: invalidate em `['inscricoes', eventoId, modalidadeId]` também atualiza a query da `EventoInscricoes` se aberta em outra aba (raro mas seguro).
- **`CampeaoSlot` extraído**: refactor não-breaking. Testar `/eventos/:id/inscricoes` ainda renderiza igual.
- **Sem testes vitest**: padrão do projeto — UI puramente integração. Smoke manual cobre.
