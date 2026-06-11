import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { competicoesService } from '../services/competicoes'
import { eventosService } from '../services/eventos'
import { participantesService } from '../services/participantes'
import { sorteiosService } from '../services/sorteios'
import { Trophy, Evento as EventoIcon, Cadastro, Dice, Plus } from '../lib/icons'
import type { LucideIcon } from 'lucide-react'

const ATIVOS_STATUS = new Set(['inscricoes', 'pronto', 'parcial'])

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

type KpiProps = {
  icon: LucideIcon
  eyebrow: string
  valor: number | string
  gradient: string
}

function KpiCard({ icon: Icon, eyebrow, valor, gradient }: KpiProps) {
  return (
    <div className="card flex items-center gap-4" style={{ padding: 20 }}>
      <div style={{ background: gradient, padding: 12, borderRadius: 12, display: 'inline-flex' }}>
        <Icon size={22} color="#fff" />
      </div>
      <div>
        <div className="eyebrow text-[var(--t3)]">{eyebrow}</div>
        <div className="text-3xl font-black tabular-nums text-[var(--t1)]">{valor}</div>
      </div>
    </div>
  )
}

export default function Painel() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })
  const { data: eventos = [] } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })
  const { data: participantes = [] } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })
  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios'],
    queryFn: () => sorteiosService.listar(),
  })

  const eventosAtivos = useMemo(() => eventos.filter(e => ATIVOS_STATUS.has(e.status)), [eventos])

  const proximos = useMemo(() => {
    return eventosAtivos
      .map(e => ({ evento: e, pendentes: e.modalidades_pendentes ?? 0 }))
      .filter(p => p.pendentes > 0)
      .sort((a, b) => new Date(a.evento.data_hora).getTime() - new Date(b.evento.data_hora).getTime())
  }, [eventosAtivos])

  async function handleCongresso() {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // permissão negada
    }
    navigate('/congresso')
  }

  return (
    <div className="p-6 space-y-6 text-[var(--t1)]">
      {/* Hero */}
      <div
        style={{
          background: 'var(--grad-brand-deep)',
          borderRadius: 22,
          padding: '44px 48px',
          color: '#fff',
        }}
      >
        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>VISÃO GERAL</div>
        <h1 className="text-3xl font-bold" style={{ color: '#fff', marginBottom: 10, letterSpacing: '-0.02em' }}>
          Olá, {user?.nome ?? user?.email ?? 'admin'}!
        </h1>
        <p className="text-sm max-w-xl" style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 24, lineHeight: 1.55 }}>
          Acompanhe o estado das competições e prepare o próximo sorteio.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCongresso}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(4px)' }}
          >
            <Trophy size={16} /> Modo Congresso
          </button>
          <button
            onClick={() => navigate('/eventos/novo')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: '#fff', color: 'var(--brand-700)' }}
          >
            <Plus size={16} /> Novo evento
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Trophy} eyebrow="COMPETIÇÕES" valor={competicoes.length} gradient="var(--grad-brand)" />
        <KpiCard icon={EventoIcon} eyebrow="EVENTOS" valor={eventos.length} gradient="var(--grad-success)" />
        <KpiCard icon={Cadastro} eyebrow="PARTICIPANTES" valor={participantes.length} gradient="var(--grad-info)" />
        <KpiCard icon={Dice} eyebrow="SORTEIOS REALIZADOS" valor={sorteios.length} gradient="var(--grad-violet)" />
      </div>

      {/* Próximos sorteios */}
      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--t1)]">Próximos sorteios</h2>
          <span className="text-xs text-[var(--t3)]">
            {proximos.length} {proximos.length === 1 ? 'pendente' : 'pendentes'}
          </span>
        </div>
        {proximos.length === 0 ? (
          <p className="text-sm text-[var(--t3)]">
            Nenhum sorteio pendente. Crie um evento ou ative as inscrições.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--card-border)]">
            {proximos.slice(0, 10).map(p => (
              <li
                key={p.evento.id}
                onClick={() => navigate(`/eventos/${p.evento.id}/inscricoes`)}
                className="py-3 cursor-pointer hover:bg-[var(--card-bg-2)] -mx-2 px-2 rounded transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--t1)]">{p.evento.nome}</div>
                    <div className="text-xs text-[var(--t3)] mt-0.5">
                      {p.evento.competicao.nome} · {formatDateBR(p.evento.data_hora)}
                    </div>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--warn-soft)] text-[var(--warn-700)] border border-[var(--warn)] whitespace-nowrap">
                    {p.pendentes} {p.pendentes === 1 ? 'pendente' : 'pendentes'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
