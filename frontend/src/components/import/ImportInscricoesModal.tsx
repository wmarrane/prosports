import { useState } from 'react'
import Papa from 'papaparse'
import { inscricoesService } from '../../services/inscricoes'
import type { ImportRow, ImportResult } from '../../types/inscricao'
import { downloadCsvTemplate } from '../../lib/csv-template'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'

type Props = {
  open: boolean
  eventoId: number
  modalidadeId: number
  onClose: () => void
  onImported: () => void
}

const REQUIRED_HEADERS = ['nome', 'municipio_uf', 'municipio_nome'] as const
type Step = 'upload' | 'review' | 'done'

const TEMPLATE = {
  filename: 'modelo_inscricoes.csv',
  headers: ['nome', 'subtitulo', 'municipio_uf', 'municipio_nome'],
  exampleRows: [
    ['João Silva', 'Clube Atlético', 'SP', 'São Paulo'],
    ['Maria Souza', '', 'RJ', 'Rio de Janeiro'],
    ['Pedro Oliveira', 'Equipe Sub-15', 'MG', 'Belo Horizonte'],
  ],
}

function StatusBadge({ status }: { status: 'criada' | 'duplicada' | 'erro' }) {
  const map = {
    criada: { label: 'Criada', color: 'bg-[var(--success-soft)] text-[var(--success-700)] border-[var(--success)]' },
    duplicada: { label: 'Duplicada', color: 'bg-[var(--warn-soft)] text-[var(--warn-700)] border-[var(--warn)]' },
    erro: { label: 'Erro', color: 'bg-[var(--danger-soft)] text-[var(--danger-700)] border-[var(--danger)]' },
  } as const
  const m = map[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${m.color}`}>
      {m.label}
    </span>
  )
}

export default function ImportInscricoesModal({ open, eventoId, modalidadeId, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [commit, setCommit] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function reset() {
    setStep('upload')
    setFile(null)
    setRows([])
    setPreview(null)
    setCommit(null)
    setLoading(false)
    setErro('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setErro('') }
  }

  function handleParseNext() {
    if (!file) { setErro('Selecione um arquivo CSV.'); return }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
        if (missing.length > 0) {
          setErro(`Cabeçalho inválido. Coluna(s) obrigatória(s) ausente(s): ${missing.join(', ')}`)
          return
        }
        const parsed: ImportRow[] = result.data
          .map(r => ({
            nome: (r.nome ?? '').trim(),
            municipio_uf: (r.municipio_uf ?? '').trim(),
            municipio_nome: (r.municipio_nome ?? '').trim(),
            subtitulo: r.subtitulo?.trim() || undefined,
          }))
          .filter(r => r.nome && r.municipio_uf && r.municipio_nome)
        if (parsed.length === 0) {
          setErro('Nenhuma linha válida encontrada no CSV.')
          return
        }
        setRows(parsed)
        runPreview(parsed)
      },
      error: (err) => setErro(`Erro ao ler CSV: ${err.message}`),
    })
  }

  async function runPreview(parsedRows: ImportRow[]) {
    setLoading(true)
    setErro('')
    try {
      const res = await inscricoesService.importar({
        evento_id: eventoId,
        modalidade_id: modalidadeId,
        dry_run: true,
        rows: parsedRows,
      })
      setPreview(res)
      setStep('review')
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao validar.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit() {
    setLoading(true)
    setErro('')
    try {
      const res = await inscricoesService.importar({
        evento_id: eventoId,
        modalidade_id: modalidadeId,
        dry_run: false,
        rows,
      })
      setCommit(res)
      setStep('done')
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao importar.')
    } finally {
      setLoading(false)
    }
  }

  function handleDone() {
    onImported()
    handleClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30" onClick={handleClose}>
      <div
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--t1)]">Importar inscrições (CSV)</h3>
          <div className="text-xs text-[var(--t3)]">
            Passo {step === 'upload' ? '1' : step === 'review' ? '2' : '3'} de 3
          </div>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            {/* Bloco: Modelo + instruções */}
            <section
              style={{
                background: 'var(--card-bg-2)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'var(--grad-brand-deep)', color: '#fff',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <div className="eyebrow">Passo 1</div>
                    <div className="text-sm font-semibold text-[var(--t1)]">Baixar modelo + instruções</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => downloadCsvTemplate(TEMPLATE)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={14} /> Baixar modelo CSV
                </button>
              </div>

              <div
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  overflowX: 'auto',
                  marginBottom: 10,
                }}
              >
                <div className="font-bold text-[var(--brand-500)] mb-1">
                  nome,subtitulo,municipio_uf,municipio_nome
                </div>
                <div className="text-[var(--t3)]">João Silva,Clube Atlético,SP,São Paulo</div>
                <div className="text-[var(--t3)]">Maria Souza,,RJ,Rio de Janeiro</div>
              </div>

              <ul className="text-xs text-[var(--t3)] space-y-1 ml-4 list-disc">
                <li><b>nome</b>: nome do participante (obrigatório).</li>
                <li><b>subtitulo</b>: opcional — aparece ao lado do nome quando a competição habilita.</li>
                <li><b>municipio_uf</b>: sigla UF em maiúsculas (ex.: <code className="font-mono">SP</code>).</li>
                <li><b>municipio_nome</b>: nome do município (case-insensitive).</li>
                <li>Participantes já cadastrados são reaproveitados; novos são criados automaticamente.</li>
                <li>UTF-8, separador vírgula, cabeçalho na primeira linha.</li>
              </ul>
            </section>

            {/* Bloco: Upload */}
            <section
              style={{
                background: 'var(--card-bg-2)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
              }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                    color: '#fff', display: 'grid', placeItems: 'center',
                  }}
                >
                  <Upload size={16} />
                </div>
                <div>
                  <div className="eyebrow">Passo 2</div>
                  <div className="text-sm font-semibold text-[var(--t1)]">Enviar arquivo preenchido</div>
                </div>
              </div>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-[var(--t1)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--brand-500)] file:text-white file:cursor-pointer file:font-semibold hover:file:bg-[var(--brand-400)]"
              />
              {file && (
                <p className="text-xs text-[var(--t3)] mt-2">
                  Selecionado: <b className="text-[var(--t1)]">{file.name}</b> · {(file.size / 1024).toFixed(1)} KB
                </p>
              )}
            </section>

            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">Cancelar</button>
              <button
                onClick={handleParseNext}
                disabled={!file || loading}
                className="btn btn-primary disabled:opacity-50"
              >{loading ? 'Validando...' : 'Próximo'}</button>
            </div>
          </div>
        )}

        {step === 'review' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--success)]">{preview.contadores.criadas}</div>
                <div className="text-xs text-[var(--t3)]">Serão criadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--warn)]">{preview.contadores.duplicadas}</div>
                <div className="text-xs text-[var(--t3)]">Duplicadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--danger)]">{preview.contadores.erros}</div>
                <div className="text-xs text-[var(--t3)]">Erros</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--brand-500)]">{preview.contadores.participantes_criados}</div>
                <div className="text-xs text-[var(--t3)]">Participantes novos</div>
              </div>
            </div>

            <div className="border border-[var(--card-border)] rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card-bg-2)] text-[var(--t2)] text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 w-12">#</th>
                    <th className="text-left px-3 py-2">Nome</th>
                    <th className="text-left px-3 py-2 w-28">Status</th>
                    <th className="text-left px-3 py-2">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(r => (
                    <tr key={r.linha} className="border-t border-[var(--card-border)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--t3)]">{r.linha}</td>
                      <td className="px-3 py-2 text-[var(--t1)]">{r.nome}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 text-xs text-[var(--t3)]">
                        {r.erro ?? (r.participante_criado ? 'Novo participante' : '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}

            <div className="flex justify-between gap-2 pt-2">
              <button onClick={() => { setStep('upload'); setPreview(null) }} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">← Voltar</button>
              <button
                onClick={handleCommit}
                disabled={loading || preview.contadores.criadas === 0}
                className="btn btn-primary disabled:opacity-50"
              >
                {loading
                  ? 'Importando...'
                  : preview.contadores.criadas === 0
                    ? 'Nada para importar'
                    : `Importar ${preview.contadores.criadas} inscriç${preview.contadores.criadas === 1 ? 'ão' : 'ões'}`}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && commit && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <h4 className="text-xl font-semibold text-[var(--t1)]">Importação concluída</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--success)]">{commit.contadores.criadas}</div>
                <div className="text-xs text-[var(--t3)]">Criadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--warn)]">{commit.contadores.duplicadas}</div>
                <div className="text-xs text-[var(--t3)]">Duplicadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--danger)]">{commit.contadores.erros}</div>
                <div className="text-xs text-[var(--t3)]">Erros</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--brand-500)]">{commit.contadores.participantes_criados}</div>
                <div className="text-xs text-[var(--t3)]">Participantes novos</div>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={handleDone} className="btn btn-primary">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
