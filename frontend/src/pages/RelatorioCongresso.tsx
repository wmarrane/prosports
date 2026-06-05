import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../services/eventos'
import { relatoriosService } from '../services/relatorios'
import PageHeader from '../components/PageHeader'
import { useToast } from '../components/Toast'
import { Download } from '../lib/icons'
import { FileText } from 'lucide-react'

function formatDateBR(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function RelatorioCongresso() {
  const toast = useToast()
  const [eventoId, setEventoId] = useState<number | ''>('')
  const [baixando, setBaixando] = useState(false)

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })

  async function baixar() {
    if (!eventoId) return
    setBaixando(true)
    try {
      const { blob, filename } = await relatoriosService.congresso(eventoId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Relatório gerado.')
    } catch (e: any) {
      let msg = 'Erro ao gerar relatório.'
      const data = e?.response?.data
      if (data instanceof Blob) {
        try {
          const text = await data.text()
          const parsed = JSON.parse(text)
          msg = parsed?.message ?? msg
        } catch {
          /* mantem default */
        }
      } else if (data?.message) {
        msg = data.message
      }
      toast.error(msg)
    } finally {
      setBaixando(false)
    }
  }

  const selecionado = eventos.find((e) => e.id === eventoId)

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Relatórios"
        title="Congresso técnico (Excel)"
        sub="Gera um arquivo .xlsx baseado no modelo Congresso, com uma aba por modalidade do evento."
      />

      <div className="p-6" style={{ maxWidth: 720 }}>
        <section
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 24,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)',
                color: '#fff', display: 'grid', placeItems: 'center',
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <div className="eyebrow">Origem</div>
              <h3 className="sec-title" style={{ fontSize: 17 }}>Evento</h3>
            </div>
          </div>

          <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
            Selecione o evento <span className="text-[var(--danger)]">*</span>
          </label>
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value ? Number(e.target.value) : '')}
            disabled={isLoading}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent"
          >
            <option value="">— escolha um evento —</option>
            {eventos.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.nome} · {formatDateBR(e.data_hora)}
              </option>
            ))}
          </select>

          {selecionado && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                background: 'var(--card-bg-2)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 13,
                color: 'var(--t2)',
              }}
            >
              Competição: <b className="text-[var(--t1)]">{selecionado.competicao?.nome ?? '—'}</b>
              <br />
              Modalidades: <b className="text-[var(--t1)]">{(selecionado.competicao as any)?.modalidades?.length ?? 0}</b>
              {' '}(cada uma vira uma aba do Excel, identificada pela sigla)
            </div>
          )}

          <div className="flex justify-end mt-5">
            <button
              type="button"
              onClick={baixar}
              disabled={!eventoId || baixando}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                opacity: !eventoId || baixando ? 0.5 : 1,
              }}
            >
              <Download size={16} /> {baixando ? 'Gerando...' : 'Baixar Excel'}
            </button>
          </div>
        </section>

        <div className="text-xs text-[var(--t3)] mt-4" style={{ lineHeight: 1.6 }}>
          <b>Notas:</b><br />
          • Cada aba reproduz o layout do template oficial (logos, cores) para o tipo da modalidade
          (Específico, Grupos, Ordem de entrada ou Chaves).<br />
          • Os campos de programação por rodada (Data/Local/Endereço/Horário) ficam em branco
          para preenchimento manual.<br />
          • Para o tipo Chaves, a lista de inscritos é preenchida automaticamente; o bracket
          mantém a estrutura do template para você consolidar.
        </div>
      </div>
    </div>
  )
}
