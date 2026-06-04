import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import MobileShell from './MobileShell'
import ModalityBadge from '../../components/modalities/ModalityBadge'
import { Check, Users } from 'lucide-react'

export default function MobileModalidades() {
  const navigate = useNavigate()
  const { data: evento } = useQuery({
    queryKey: ['key-access', 'me'],
    queryFn: keyAccessService.me,
    refetchInterval: 60_000,
    select: r => r.evento,
  })
  const { data: modalidades = [], isLoading, refetch } = useQuery({
    queryKey: ['key-access', 'modalidades'],
    queryFn: keyAccessService.modalidades,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  return (
    <MobileShell evento={evento ?? null} onRefresh={() => refetch()}>
      <div style={{ marginBottom: 12 }}>
        <div className="eyebrow" style={{ color: 'var(--t3)' }}>Modalidades</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: '4px 0 0' }}>
          {modalidades.length} {modalidades.length === 1 ? 'modalidade' : 'modalidades'}
        </h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : modalidades.length === 0 ? (
        <p className="text-sm text-[var(--t4)] italic">Nenhuma modalidade.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modalidades.map((m: any) => {
            const tipo = m.tipo_modalidade?.tipo ?? 'especifico'
            return (
              <button
                key={m.id}
                onClick={() => navigate(`/m/${m.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-xl)',
                  textAlign: 'left', cursor: 'pointer', width: '100%',
                }}
              >
                <ModalityBadge name={m.nome} size={40} showGender />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{m.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                    {m.sigla} · {tipo === 'especifico' ? 'Específico' : tipo === 'ordem_entrada' ? 'Ordem' : tipo[0].toUpperCase() + tipo.slice(1)}
                  </div>
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px',
                  background: 'var(--card-bg-2)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-pill)',
                  flexShrink: 0,
                }}>
                  <Users size={12} style={{ color: 'var(--t3)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-mono)' }}>
                    {m.inscritos_count ?? 0}
                  </span>
                </div>
                <Check size={14} style={{ color: 'var(--t4)', flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      )}
    </MobileShell>
  )
}
