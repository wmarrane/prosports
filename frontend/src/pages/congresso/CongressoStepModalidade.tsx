import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { inscricoesService } from '../../services/inscricoes'
import { TIPO_DISPUTA_LABEL } from '../../lib/tipo-disputa'
import { Brackets, Group, ListOrdered, FileText, Check, ArrowRight } from 'lucide-react'

type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
}

const TIPO_ICON: Record<string, typeof Brackets> = {
  chaves: Brackets,
  grupos: Group,
  ordem_entrada: ListOrdered,
  especifico: FileText,
}

const TIPO_GRAD: Record<string, string> = {
  chaves: 'linear-gradient(135deg, #1061d8 0%, #4f8ef7 100%)',
  grupos: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
  ordem_entrada: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  especifico: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
}

const TIPO_DESC: Record<string, string> = {
  chaves: 'Eliminação simples em chaveamento. Vencedor avança a cada rodada.',
  grupos: 'Distribuição em grupos com classificação interna por critério.',
  ordem_entrada: 'Apenas ordem de entrada/apresentação dos participantes.',
  especifico: 'Modalidade sem sorteio automático — definida manualmente.',
}

export default function CongressoStepModalidade({ eventoId, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })

  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))
  const restantes = modalidades.filter(m => !sorteadasIds.has(m.id)).length

  // Auto-select primeira modalidade não sorteada (ou primeira da lista)
  useEffect(() => {
    if (selectedId == null && modalidades.length > 0) {
      const naoSorteada = modalidades.find(m => !sorteadasIds.has(m.id))
      setSelectedId((naoSorteada ?? modalidades[0]).id)
    }
  }, [modalidades, selectedId, sorteadasIds])

  const selectedMod = modalidades.find(m => m.id === selectedId) ?? null

  const { data: inscricoesSel = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, selectedId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: selectedId! }),
    enabled: selectedId != null,
  })

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
        {evento?.nome} · {restantes > 0 ? `${restantes} ${restantes === 1 ? 'modalidade' : 'modalidades'} a sortear` : 'todas concluídas'}
      </p>

      <div className="cw-md">
        {/* Lista esquerda */}
        <div className="cw-md-list">
          {modalidades.map(m => {
            const sorteada = sorteadasIds.has(m.id)
            const tipo = m.tipo_modalidade?.tipo ?? 'especifico'
            const Icon = TIPO_ICON[tipo] ?? FileText
            const grad = TIPO_GRAD[tipo]
            return (
              <button
                key={m.id}
                className={`cw-md-item ${selectedId === m.id ? 'sel' : ''}`}
                onClick={() => setSelectedId(m.id)}
              >
                <span className="cw-md-ic" style={{ background: grad }}>
                  <Icon size={20} />
                </span>
                <span className="cw-md-name">{m.nome}</span>
                {sorteada && (
                  <span className="cw-md-done"><Check size={15} /></span>
                )}
              </button>
            )
          })}
        </div>

        {/* Detalhe direita */}
        <div className="cw-md-detail">
          {selectedMod ? (
            (() => {
              const tipo = selectedMod.tipo_modalidade?.tipo ?? 'especifico'
              const Icon = TIPO_ICON[tipo] ?? FileText
              const grad = TIPO_GRAD[tipo]
              const sorteada = sorteadasIds.has(selectedMod.id)
              const tipoLabel = selectedMod.tipo_modalidade ? TIPO_DISPUTA_LABEL[selectedMod.tipo_modalidade.tipo] : '—'
              return (
                <div className="cw-md-card">
                  <div className="cw-md-card-top">
                    <span
                      className="cw-card-ic cw-big-ic"
                      style={{ background: grad, width: 84, height: 84, borderRadius: 22, margin: 0 }}
                    >
                      <Icon size={40} />
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                      {sorteada && (
                        <span className="cw-badge b-success">
                          <Check size={14} /> Sorteado
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
                      <b>{tipoLabel}</b>
                      <span>Forma do sorteio</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => onSelect(selectedMod.id)}
                      className="cw-btn cw-btn-primary cw-btn-xl"
                    >
                      Iniciar <ArrowRight size={22} />
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
