import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { modalidadesService } from '../../services/modalidades'
import { downloadCsvTemplate } from '../../lib/csv-template'
import { Check, X, Download } from '../../lib/icons'
import { FileSpreadsheet, Upload } from 'lucide-react'

type ImportResumo = {
  criados: number
  atualizados: number
  ignorados: number
  erros: Array<{ linha: number; motivo: string }>
}

type Props = {
  open: boolean
  competicaoId: number
  onClose: () => void
  onImported: () => void
}

const TEMPLATE = {
  filename: 'modelo_modalidades.csv',
  headers: ['nome', 'sigla', 'tipo_modalidade'],
  exampleRows: [
    ['Basquete Masculino Livre', 'BML', 'Chaves'],
    ['Voleibol Feminino 21-anos', 'VF21', 'Grupos'],
    ['Atletismo Feminino Livre', 'AFL', 'Específico'],
  ],
}

export default function ImportModalidadesModal({ open, competicaoId, onClose, onImported }: Props) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [resumo, setResumo] = useState<ImportResumo | null>(null)
  const [erro, setErro] = useState('')

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: () => modalidadesService.importar(competicaoId, file!),
    onSuccess: r => {
      setResumo(r)
      queryClient.invalidateQueries({ queryKey: ['modalidades'] })
      onImported()
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao importar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setResumo(null)
    if (file) enviar()
  }

  function handleClose() {
    setFile(null)
    setResumo(null)
    setErro('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30" onClick={handleClose}>
      <div
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--t1)]">Importar modalidades (CSV)</h3>
          <button onClick={handleClose} className="text-[var(--t3)] hover:text-[var(--t1)]"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          {/* Bloco: Modelo + instruções */}
          <section style={{
            background: 'var(--card-bg-2)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 16,
          }}>
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--grad-brand-deep)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}>
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

            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              overflowX: 'auto',
              marginBottom: 10,
            }}>
              <div className="font-bold text-[var(--brand-500)] mb-1">nome,sigla,tipo_modalidade</div>
              <div className="text-[var(--t3)]">Basquete Masculino Livre,BML,Chaves</div>
              <div className="text-[var(--t3)]">Voleibol Feminino 21-anos,VF21,Grupos</div>
              <div className="text-[var(--t3)]">Atletismo Feminino Livre,AFL,Específico</div>
            </div>

            <ul className="text-xs text-[var(--t3)] space-y-1 ml-4 list-disc">
              <li><b>nome</b>: nome da modalidade (obrigatório).</li>
              <li><b>sigla</b>: 2+ caracteres (obrigatório).</li>
              <li><b>tipo_modalidade</b>: nome do tipo já cadastrado em "Tipos de Modalidade" (case-insensitive).</li>
              <li>Modalidades já cadastradas (mesmo nome nesta competição) são <b>atualizadas</b>; novas são <b>criadas</b>.</li>
              <li>UTF-8, separador vírgula, cabeçalho na primeira linha.</li>
            </ul>
          </section>

          {/* Bloco: Upload */}
          <section style={{
            background: 'var(--card-bg-2)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 16,
          }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                color: '#fff', display: 'grid', placeItems: 'center',
              }}>
                <Upload size={16} />
              </div>
              <div>
                <div className="eyebrow">Passo 2</div>
                <div className="text-sm font-semibold text-[var(--t1)]">Enviar arquivo preenchido</div>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[var(--t1)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--brand-500)] file:text-white file:cursor-pointer file:font-semibold hover:file:bg-[var(--brand-400)]"
              />
              {file && (
                <p className="text-xs text-[var(--t3)] mt-2">
                  Selecionado: <b className="text-[var(--t1)]">{file.name}</b> · {(file.size / 1024).toFixed(1)} KB
                </p>
              )}

              {erro && (
                <div style={{
                  background: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '10px 14px',
                  fontSize: 13,
                  marginTop: 12,
                }}>{erro}</div>
              )}

              <div className="flex justify-end gap-2.5 mt-4">
                <button type="button" onClick={handleClose} className="btn btn-ghost"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <X size={16} /> {resumo ? 'Fechar' : 'Cancelar'}
                </button>
                {!resumo && (
                  <button type="submit" disabled={!file || isPending} className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !file || isPending ? 0.5 : 1 }}>
                    <Upload size={16} /> {isPending ? 'Enviando...' : 'Enviar e processar'}
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* Resultado */}
          {resumo && (
            <section style={{
              background: 'var(--card-bg-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 16,
            }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}>
                  <Check size={16} />
                </div>
                <div>
                  <div className="eyebrow">Resultado</div>
                  <div className="text-sm font-semibold text-[var(--t1)]">Importação concluída</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Criados', value: resumo.criados, color: 'var(--success)' },
                  { label: 'Atualizados', value: resumo.atualizados, color: 'var(--brand-500)' },
                  { label: 'Ignorados', value: resumo.ignorados, color: 'var(--t3)' },
                  { label: 'Erros', value: resumo.erros.length, color: 'var(--danger)' },
                ].map(s => (
                  <div key={s.label} style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>
                      {s.value}
                    </div>
                    <div className="text-xs text-[var(--t3)] mt-1 uppercase tracking-wider font-semibold">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {resumo.erros.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-[var(--t2)] font-semibold">
                    Ver detalhes dos {resumo.erros.length} erros
                  </summary>
                  <ul className="mt-2 text-xs space-y-1.5" style={{
                    background: 'var(--danger-soft)',
                    color: 'var(--danger)',
                    border: '1px solid var(--danger)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}>
                    {resumo.erros.map(e => (
                      <li key={e.linha}><b>Linha {e.linha}:</b> {e.motivo}</li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
