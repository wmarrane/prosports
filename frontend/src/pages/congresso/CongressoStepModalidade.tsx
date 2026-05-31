import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { TIPO_DISPUTA_LABEL } from '../../lib/tipo-disputa'
import { Brackets, Group, ListOrdered, FileText, Check } from 'lucide-react'

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

export default function CongressoStepModalidade({ eventoId, onSelect }: Props) {
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

  if (isLoading) {
    return (
      <>
        <h1 className="cw-h1">Modalidades do evento</h1>
        <p className="cw-sub">Carregando modalidades...</p>
      </>
    )
  }

  return (
    <>
      <h1 className="cw-h1">Modalidades do evento</h1>
      <p className="cw-sub">
        {evento?.nome} · {restantes > 0 ? `${restantes} ${restantes === 1 ? 'modalidade' : 'modalidades'} a sortear` : 'todas concluídas'}
      </p>

      {modalidades.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: 'var(--cw-dim)',
          background: 'var(--cw-card)', border: '1px dashed var(--cw-card-bd)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <p style={{ fontSize: 18 }}>Nenhuma modalidade cadastrada nesta competição.</p>
        </div>
      ) : (
        <div className="cw-grid">
          {modalidades.map(m => {
            const sorteada = sorteadasIds.has(m.id)
            const tipo = m.tipo_modalidade?.tipo ?? 'especifico'
            const Icon = TIPO_ICON[tipo] ?? FileText
            const grad = TIPO_GRAD[tipo]
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className={`cw-card ${sorteada ? 'sel' : ''}`}
              >
                <div className="cw-card-top">
                  <span className="cw-card-ic" style={{ background: grad }}>
                    <Icon size={28} />
                  </span>
                  {sorteada && (
                    <span className="cw-badge b-success">
                      <Check size={14} /> Sorteado
                    </span>
                  )}
                </div>
                <div className="cw-card-title">{m.nome}</div>
                <div className="cw-card-meta">{m.sigla} · {m.tipo_modalidade ? TIPO_DISPUTA_LABEL[m.tipo_modalidade.tipo] : '—'}</div>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
