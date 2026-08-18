# Evento com publicação manual no site público — Design

**Data:** 2026-08-18
**Status:** Aprovado (design).

## Objetivo

Dar ao evento um parâmetro que desliga **toda** publicação automática no site
público. Com ele ligado, o site só muda por ação explícita do admin nos botões
Publicar / Publicar parcial / Despublicar.

Eventos sem o parâmetro seguem exatamente como hoje.

## O que é automático hoje

| Gatilho | Efeito | Onde |
|---|---|---|
| Mudança de status do evento | vira `pronto`/`parcial`/`sorteado` → publica; vira `rascunho`/`inscricoes`/`suspenso` → despublica (se publicado) | `eventos.service.editar` → `decidirAcaoPublicacao` |
| Boletim criado, removido ou substituído | republica o site, se o evento já estiver publicado | `boletins.service.republicarSePublicado` |

Manual: `POST /eventos/:id/publicar`, `/publicar-parcial`, `/despublicar`
(`site-publico.controller`).

## Decisões aprovadas

- **Escopo: nada automático.** O parâmetro bloqueia os três gatilhos — publicar
  por status, despublicar por status e republicar por boletim.
- **Onde mora a trava:** dentro de `publicar`/`despublicar`, não nos chamadores.
  É um ponto único de estrangulamento; gatilhos automáticos futuros já nascem
  cobertos. *(Alternativa descartada: checar o flag em cada chamador — espalha a
  regra por dois arquivos e o próximo gatilho esquece dela.)*
- **Bloqueio é silencioso**, não erro: a chamada automática retorna sem fazer
  nada e registra `debug` no log. Não é falha, é comportamento esperado.
- **Parâmetro no EVENTO**, não na competição — eventos da mesma competição podem
  ter tratamentos diferentes.

## Arquitetura

**Schema** — `Evento.publicacao_manual Boolean @default(false)`. Migration
aditiva; o default preserva o comportamento de todos os eventos existentes.

**Backend** — `publicar(eventoId, opts)` e `despublicar(eventoId, opts)` passam a
aceitar `origem: 'manual' | 'automatica'`:

```ts
type OrigemPublicacao = 'manual' | 'automatica'
publicar(eventoId: number, opts?: { permitirParcial?: boolean; origem?: OrigemPublicacao })
despublicar(eventoId: number, opts?: { origem?: OrigemPublicacao })
```

Quando `origem === 'automatica'` e o evento tem `publicacao_manual`, a função
retorna sem efeito. Chamadores:

- `site-publico.controller` (3 endpoints) → `origem: 'manual'`
- `eventos.service.editar` → `origem: 'automatica'`
- `boletins.service.republicarSePublicado` → `origem: 'automatica'`

O default de `origem` é `'automatica'`: se um chamador novo esquecer de informar,
ele erra para o lado seguro (respeita o flag) em vez de furar a regra.

**Frontend** — checkbox no editor de evento (`EventoForm`), rotulado
*"Publicação manual — este evento não é publicado nem atualizado automaticamente
no site público"*.

## Consequências aceitas

1. **Ligar o flag não despublica.** Um evento no ar continua no ar; apenas para
   de reagir sozinho. Para tirar do ar, é o botão Despublicar.
2. **Evento suspenso continua visível** ao público até alguém despublicar na mão
   — decorrência de bloquear o despublicar automático.
3. **O site pode ficar desatualizado em silêncio** depois de um boletim novo, já
   que a republicação também é bloqueada.

## Não muda

Publicar continua exigindo status `sorteado` (ou parcial, via
`permitirParcial`). O parâmetro não afeta essa validação — ela segue valendo nas
chamadas manuais.

## Verificação

Unit (mock de prisma), em `site-publico.service.test.ts`:

- flag desligada: publicar/despublicar automáticos funcionam como hoje;
- flag ligada: `origem: 'automatica'` não grava snapshot, não dispara build e não
  altera `site_publicado_em`, nos dois sentidos;
- flag ligada: `origem: 'manual'` publica e despublica normalmente;
- `origem` omitida é tratada como automática.

Ponta a ponta no ambiente local: evento com o flag ligado não publica ao mudar
para `sorteado`, não sai do ar ao voltar para `rascunho` e não republica ao
receber boletim; os botões continuam funcionando.

## Fora de escopo

- Aviso na tela de "há alterações não publicadas" (pode vir depois, se a
  consequência 3 incomodar na prática).
- Qualquer mudança no comportamento de eventos sem o parâmetro.
