import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../components/PageHeader'
import { competicoesService } from '../services/competicoes'
import { modalidadesService } from '../services/modalidades'
import { tiposModalidadeService } from '../services/tipos-modalidade'
import { municipiosService } from '../services/municipios'
import { inspetoriasService } from '../services/inspetorias'
import { delegaciasService } from '../services/delegacias'
import { Trophy, Bracket, Order, Cadastro, ArrowRight } from '../lib/icons'
import type { LucideIcon } from 'lucide-react'

type CardConfig = {
  eyebrow: string
  rota: string
  icon: LucideIcon
  gradient: string
  valor: number | string
}

function AdminCard({ eyebrow, rota, icon: Icon, gradient, valor }: CardConfig) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(rota)}
      className="card flex items-center gap-4 text-left w-full hover:border-[var(--brand-400)] transition-colors"
      style={{ padding: 20 }}
    >
      <div style={{ background: gradient, padding: 14, borderRadius: 12, display: 'inline-flex' }}>
        <Icon size={26} color="#fff" />
      </div>
      <div className="flex-1">
        <div className="eyebrow text-[var(--t3)]">{eyebrow}</div>
        <div className="text-2xl font-black tabular-nums text-[var(--t1)]">{valor}</div>
      </div>
      <ArrowRight size={18} className="text-[var(--t3)]" />
    </button>
  )
}

export default function Admin() {
  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })
  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: () => modalidadesService.listar(),
  })
  const { data: tiposModalidade = [] } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })
  const { data: municipiosPage } = useQuery({
    queryKey: ['municipios', 'count'],
    queryFn: () => municipiosService.listar({ limit: 1 }),
  })
  const { data: inspetorias = [] } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: () => inspetoriasService.listar(),
  })
  const { data: delegacias = [] } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  function valor(n: number | undefined): number | string {
    return n === undefined ? '—' : n
  }

  const cards: CardConfig[] = [
    { eyebrow: 'COMPETIÇÕES', rota: '/competicoes', icon: Trophy, gradient: 'var(--grad-brand)', valor: valor(competicoes.length) },
    { eyebrow: 'MODALIDADES', rota: '/modalidades', icon: Bracket, gradient: 'var(--grad-warn)', valor: valor(modalidades.length) },
    { eyebrow: 'TIPOS DE MODALIDADE', rota: '/tipos-modalidade', icon: Order, gradient: 'var(--grad-success)', valor: valor(tiposModalidade.length) },
    { eyebrow: 'MUNICÍPIOS', rota: '/municipios', icon: Cadastro, gradient: 'var(--grad-info)', valor: valor(municipiosPage?.total) },
    { eyebrow: 'INSPETORIAS', rota: '/inspetorias', icon: Cadastro, gradient: 'var(--grad-violet)', valor: valor(inspetorias.length) },
    { eyebrow: 'DELEGACIAS', rota: '/delegacias', icon: Cadastro, gradient: 'var(--grad-brand)', valor: valor(delegacias.length) },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader eyebrow="GESTÃO" title="Administração" sub="Cadastros e configurações do sistema." />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <AdminCard key={c.eyebrow} {...c} />
          ))}
        </div>
      </div>
    </div>
  )
}
