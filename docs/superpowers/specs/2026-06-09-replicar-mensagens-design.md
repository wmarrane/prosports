# Replicar mensagens de uma modalidade para outras — Design

**Data:** 2026-06-09
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Permitir, a partir do cadastro de uma modalidade, **replicar as regras de mensagem** (`mensagens_inscritos`) para outras modalidades **do mesmo tipo**, substituindo as mensagens das modalidades-alvo.

## Decisões (do brainstorming)

1. **Alvos:** modalidades do **mesmo tipo** da origem, em **qualquer competição** (exceto a própria). Lista agrupada por competição.
2. **Comportamento:** **substituir** (overwrite) — as mensagens do alvo passam a ser idênticas às replicadas.
3. **Fonte das mensagens:** as **mensagens atuais da tela** (o que está no card do `ModalidadeForm`), não exige salvar a origem antes.
4. Disponível só em **modo de edição** (origem precisa ter `id`) e para tipos **Grupo/Chaves**.

## Backend

### Rota
`backend/src/modules/modalidades/modalidades.routes.ts`: `router.post('/replicar-mensagens', ...admin, ctrl.replicarMensagens)` (caminho fixo POST; sem colisão com `POST '/'` nem com os `/:id` que são GET/PUT/DELETE).

### Controller
`modalidades.controller.ts`: `replicarMensagens` valida o body com zod:
```ts
const replicarSchema = z.object({
  origem_id: z.number().int().positive(),
  destino_ids: z.array(z.number().int().positive()).min(1),
  mensagens: z.array(z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1).nullable(),
    mensagem: z.string(),
    pular_sorteio: z.boolean(),
  })),
})
```
Responde `200 { replicadas: number }`.

### Service
`modalidades.service.ts`: 
```ts
export async function replicarMensagens(origem_id: number, destino_ids: number[], mensagens: unknown): Promise<{ replicadas: number }>
```
- Carrega a origem (`findUnique({ where: { id: origem_id }, select: { tipo_modalidade: { select: { tipo } } } })`); se não existir → 404.
- Carrega os destinos: `findMany({ where: { id: { in: destino_ids } }, select: { id, tipo_modalidade: { select: { tipo } } } })`.
- Filtra os destinos com **mesmo tipo** da origem e `id !== origem_id`.
- Atualiza cada destino válido: `update({ where: { id }, data: { mensagens_inscritos: mensagens } as any })` (numa `$transaction`/`Promise.all`).
- Retorna `{ replicadas: <qtde de destinos válidos atualizados> }` (destinos de tipo diferente são ignorados, não contam).

## Frontend

### Serviço
`frontend/src/services/modalidades.ts`:
```ts
replicarMensagens: (data: { origem_id: number; destino_ids: number[]; mensagens: MensagemInscritos[] }) =>
  api.post<{ replicadas: number }>(`${BASE}/replicar-mensagens`, data).then(r => r.data),
```

### UI — `ModalidadeForm.tsx`
- No card "Mensagens por nº de inscritos", ao lado de "Adicionar mensagem", botão **"Replicar para outras modalidades…"**, visível só quando `isEdit` (tem `id`) e tipo Grupo/Chaves.
- Abre um **modal** (`ReplicarMensagensModal`):
  - Query `modalidadesService.listar()` → filtra `tipo_modalidade.tipo === tipoSelecionado.tipo` e `id !== id atual`.
  - Lista **agrupada por competição** (`competicao.nome`), cada item com checkbox; "Selecionar todos" por grupo e geral; busca textual opcional (nome/sigla, normalizada — pode reusar `normalize` de `lib/command-palette.ts`).
  - Texto de aviso: "As mensagens configuradas acima substituirão as mensagens das modalidades selecionadas."
  - Botão confirmar (desabilitado se nenhum selecionado): chama `replicarMensagens({ origem_id: id, destino_ids, mensagens })` (mensagens = estado atual do form), fecha, `toast.success('Replicado para N modalidades')`. Erro → `toast.error`.

### Componente
`frontend/src/components/ReplicarMensagensModal.tsx` (novo) — props `{ open, onClose, tipo, origemId, mensagens }`. Mantém o `ModalidadeForm` enxuto.

## Testes

- `backend/src/modules/modalidades/modalidades.service.test.ts`:
  - `replicarMensagens` atualiza só destinos de **mesmo tipo** e ignora os de tipo diferente; retorna a contagem correta.
  - lança 404 quando a origem não existe.
  - ignora `origem_id` se vier nos `destino_ids`.
- Frontend: se a filtragem/agrupamento de alvos for extraída em função pura (`agruparAlvos`), testar com Vitest; o modal em si por build + verificação manual.

## Fora de escopo

- Replicar para tipos diferentes do da origem.
- Merge/append (apenas substituição).
- Desfazer (undo) — o modal confirma antes; sem histórico.
- Replicar a partir de modalidade nova não salva (precisa de `id`).
