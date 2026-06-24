import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { sorteiosService } from '../../services/sorteios'
import { inscricoesService } from '../../services/inscricoes'
import { sistemasDisputaService } from '../../services/sistemas-disputa'
import { TIPO_DISPUTA_LABEL } from '../../lib/tipo-disputa'
import { Check, ArrowRight, FileText, ChevronUp, ChevronDown } from 'lucide-react'
import ModalityBadge from '../../components/modalities/ModalityBadge'

const EMPTY_IDS: Set<number> = new Set()
const LISTA_KEY = 'prosports.congresso.lista-aberta'

type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
  vistasIds?: Set<number>
  onPularVazia?: (modalidadeId: number) => void
}

const TIPO_DESC: Record<string, string> = {
  chaves: 'Eliminação simples em chaveamento. Vencedor avança a cada rodada.',
  grupos: 'Distribuição em grupos com classificação interna por critério.',
  ordem_entrada: 'Apenas ordem de entrada/apresentação dos participantes.',
  especifico: 'Modalidade sem sorteio automático — definida manualmente.',
}

export default function CongressoStepModalidade({ eventoId, onSelect, vistasIds = EMPTY_IDS, onPularVazia }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [listaAberta, setListaAberta] = useState<boolean>(() => {
    try { return localStorage.getItem(LISTA_KEY) !== 'false' } catch { return true }
  })
  const listRef = useRef<HTMLDivElement>(null)

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId),
    enabled: !!evento,
  })

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })

  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))
  const isConcluida = (id: number) => sorteadasIds.has(id) || vistasIds.has(id)
  const restantes = modalidades.filter(m => !isConcluida(m.id)).length

  // Auto-select primeira modalidade não concluída (não sorteada e não vista), ou a primeira
  useEffect(() => {
    if (selectedId == null && modalidades.length > 0) {
      const naoConcluida = modalidades.find(m => !isConcluida(m.id))
      setSelectedId((naoConcluida ?? modalidades[0]).id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalidades, selectedId, sorteios, vistasIds])

  // Garante que o item selecionado fique visível na lista
  useEffect(() => {
    if (selectedId == null || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-mid="${selectedId}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  const selectedMod = modalidades.find(m => m.id === selectedId) ?? null

  const { data: inscricoesSel = [], isLoading: inscricoesLoading } = useQuery({
    queryKey: ['inscricoes', eventoId, selectedId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: selectedId! }),
    enabled: selectedId != null,
  })

  const { data: regrasGrupos = [] } = useQuery({
    queryKey: ['sistemas-disputa-grupos', evento?.competicao_id],
    queryFn: () => sistemasDisputaService.grupos.listar(evento!.competicao_id),
    enabled: evento?.competicao_id != null,
  })

  const vazia = !inscricoesLoading && selectedMod != null && inscricoesSel.length === 0

  function pularVazia() {
    if (!selectedMod) return
    onPularVazia?.(selectedMod.id)
    const idx = modalidades.findIndex(m => m.id === selectedMod.id)
    const after = modalidades.slice(idx + 1).find(m => !isConcluida(m.id))
    const before = modalidades.slice(0, idx).find(m => !isConcluida(m.id))
    const proxima = after ?? before
    setSelectedId(proxima ? proxima.id : selectedMod.id)
  }

  if (isLoading) {
    return (
      <>
        <h1 className="cw-h1">Modalidades do evento</h1>
        <p className="cw-sub">Carregando modalidades...</p>
      </>
    )
  }

  if (modalidades.length === 0) {
    return (
      <>
        <h1 className="cw-h1">Modalidades do evento</h1>
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: 'var(--cw-dim)',
          background: 'var(--cw-card)', border: '1px dashed var(--cw-card-bd)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <p style={{ fontSize: 18 }}>Nenhuma modalidade cadastrada nesta competição.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="cw-h1">Modalidades do evento</h1>
      <p className="cw-sub">
        {evento?.nome} · {restantes > 0 ? `${restantes} ${restantes === 1 ? 'modalidade restante' : 'modalidades restantes'}` : 'todas concluídas'}
      </p>

      <div className={`cw-md${listaAberta ? '' : ' cw-md--recolhido'}`}>
        {/* Lista esquerda (recolhível) */}
        <div className="cw-md-listcol">
          <button
            type="button"
            className="cw-md-list-toggle"
            onClick={() => setListaAberta(v => {
              const nv = !v
              try { localStorage.setItem(LISTA_KEY, String(nv)) } catch { /* storage indisponível */ }
              return nv
            })}
            aria-expanded={listaAberta}
          >
            <span>Modalidades <b>{modalidades.length}</b></span>
            {listaAberta ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {listaAberta && (
            <div className="cw-md-list" ref={listRef}>
              {modalidades.map(m => {
                const concluida = isConcluida(m.id)
                return (
                  <button
                    key={m.id}
                    data-mid={m.id}
                    className={`cw-md-item ${selectedId === m.id ? 'sel' : ''}`}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <ModalityBadge name={m.nome} size={40} showGender />
                    <span className="cw-md-name">{m.nome}</span>
                    {concluida && (
                      <span className="cw-md-done"><Check size={15} /></span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Detalhe direita */}
        <div className="cw-md-detail">
          {selectedMod ? (
            (() => {
              const tipo = selectedMod.tipo_modalidade?.tipo ?? 'especifico'
              const sorteada = sorteadasIds.has(selectedMod.id)
              const vista = !sorteada && vistasIds.has(selectedMod.id)
              const tipoLabel = selectedMod.tipo_modalidade ? TIPO_DISPUTA_LABEL[selectedMod.tipo_modalidade.tipo] : '—'
              const quantidadeGrupos = tipo === 'grupos' && inscricoesSel.length > 0
                ? regrasGrupos.find(r => r.quantidade_equipes === inscricoesSel.length)?.quantidade_grupos
                : undefined
              const formaSorteioLabel = quantidadeGrupos != null ? `${quantidadeGrupos} Grupos` : tipoLabel
              return (
                <div className="cw-md-card">
                  <div className="cw-md-card-top">
                    <ModalityBadge name={selectedMod.nome} size={84} showGender />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                      {sorteada && (
                        <span className="cw-badge b-success">
                          <Check size={14} /> Sorteado
                        </span>
                      )}
                      {vista && (
                        <span className="cw-badge b-success">
                          <Check size={14} /> Apresentada
                        </span>
                      )}
                      {evento?.logo_url && (
                        <div
                          style={{
                            width: 110, height: 110,
                            display: 'grid', placeItems: 'center',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--cw-card-bd)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 8, overflow: 'hidden',
                          }}
                          title={`Logo de ${evento.nome}`}
                        >
                          <img
                            src={evento.logo_url}
                            alt={`Logo ${evento.nome}`}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="cw-md-card-eyebrow">{tipoLabel}</div>
                  <h2 className="cw-md-card-title">{selectedMod.nome}</h2>
                  <p className="cw-md-card-desc">{TIPO_DESC[tipo] ?? ''}</p>
                  <div className="cw-md-card-stats">
                    <div className="cw-md-stat">
                      <b>{inscricoesSel.length}</b>
                      <span>Inscritos</span>
                    </div>
                    <div className="cw-md-stat">
                      <b>{formaSorteioLabel}</b>
                      <span>Forma do sorteio</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => (vazia ? pularVazia() : onSelect(selectedMod.id))}
                      className="cw-btn cw-btn-primary cw-btn-xl"
                    >
                      {vazia ? 'Próxima' : 'Iniciar'} <ArrowRight size={22} />
                    </button>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="cw-md-empty">
              <FileText size={52} />
              <p>Selecione uma modalidade ao lado para ver os detalhes.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
