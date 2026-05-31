import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { municipiosService } from '../../services/municipios'
import type { ImportResumo } from '../../types/municipio'
import { Check, X, Download } from '../../lib/icons'
import { Building2, FileSpreadsheet, Upload } from 'lucide-react'
import { downloadCsvTemplate } from '../../lib/csv-template'

const TEMPLATE = {
  filename: 'modelo_municipios.csv',
  headers: ['codigo_ibge', 'nome', 'uf'],
  exampleRows: [
    ['3550308', 'São Paulo', 'SP'],
    ['3304557', 'Rio de Janeiro', 'RJ'],
    ['3106200', 'Belo Horizonte', 'MG'],
  ],
}

export default function MunicipiosImport() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [resumo, setResumo] = useState<ImportResumo | null>(null)
  const [erro, setErro] = useState('')

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: () => municipiosService.importar(file!),
    onSuccess: r => {
      setResumo(r)
      queryClient.invalidateQueries({ queryKey: ['municipios'] })
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao importar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setResumo(null)
    if (file) enviar()
  }

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    marginBottom: 16,
    boxShadow: 'var(--shadow-card)',
  } as const

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title="Importar Municípios"
        sub="Suba um arquivo CSV para criar/atualizar municípios em lote pelo código IBGE."
        backTo="/municipios"
      />

      <div className="p-6" style={{ maxWidth: 800 }}>
        {/* Card: Modelo + instruções */}
        <section style={cardStyle}>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--grad-brand-deep)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <div className="eyebrow">Passo 1</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Baixar modelo + instruções</h3>
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

          <p className="text-sm text-[var(--t2)] mb-3">
            O arquivo CSV deve conter as colunas abaixo (UTF-8, separador vírgula):
          </p>

          <div
            style={{
              background: 'var(--card-bg-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--t1)',
              overflowX: 'auto',
              marginBottom: 14,
            }}
          >
            <div className="font-bold text-[var(--brand-500)] mb-1">
              codigo_ibge,nome,uf
            </div>
            <div className="text-[var(--t3)]">3550308,São Paulo,SP</div>
            <div className="text-[var(--t3)]">3304557,Rio de Janeiro,RJ</div>
          </div>

          <div className="text-sm text-[var(--t2)] space-y-2">
            <div className="font-semibold">Instruções de preenchimento:</div>
            <ul className="text-xs text-[var(--t3)] space-y-1.5 ml-4 list-disc">
              <li><b>codigo_ibge</b>: 7 dígitos, oficial do IBGE (ex.: <code className="font-mono">3550308</code>). Aceita o alias <code className="font-mono">Código Município Completo</code>.</li>
              <li><b>nome</b>: nome oficial do município (ex.: <code className="font-mono">São Paulo</code>). Aceita o alias <code className="font-mono">Nome_Município</code>.</li>
              <li><b>uf</b>: sigla da unidade federativa em maiúsculas (ex.: <code className="font-mono">SP</code>). Aceita o alias <code className="font-mono">Nome_UF</code>.</li>
              <li>Municípios existentes (mesmo <code className="font-mono">codigo_ibge</code>) são <b>atualizados</b>; novos são <b>criados</b>.</li>
              <li>Cabeçalho na primeira linha. Linhas em branco são ignoradas.</li>
            </ul>
          </div>
        </section>

        {/* Card: Upload */}
        <section style={cardStyle}>
          <div className="flex items-center gap-3 mb-4">
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                color: '#fff', display: 'grid', placeItems: 'center',
              }}
            >
              <Upload size={18} />
            </div>
            <div>
              <div className="eyebrow">Passo 2</div>
              <h3 className="sec-title" style={{ fontSize: 17 }}>Enviar arquivo preenchido</h3>
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
                <Building2 size={12} className="inline mr-1" />
                Selecionado: <b className="text-[var(--t1)]">{file.name}</b> · {(file.size / 1024).toFixed(1)} KB
              </p>
            )}

            {erro && (
              <div
                style={{
                  background: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '10px 14px',
                  fontSize: 13,
                  marginTop: 12,
                }}
              >
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => navigate('/municipios')}
                className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <X size={16} /> Cancelar
              </button>
              <button
                type="submit"
                disabled={!file || isPending}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !file || isPending ? 0.5 : 1 }}
              >
                <Upload size={16} />
                {isPending ? 'Enviando...' : 'Enviar e processar'}
              </button>
            </div>
          </form>
        </section>

        {/* Card: Resultado */}
        {resumo && (
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-4">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <Check size={18} />
              </div>
              <div>
                <div className="eyebrow">Resultado</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Importação concluída</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Criados" value={resumo.criados} color="var(--success)" />
              <Stat label="Atualizados" value={resumo.atualizados} color="var(--brand-500)" />
              <Stat label="Ignorados" value={resumo.ignorados} color="var(--t3)" />
              <Stat label="Erros" value={resumo.erros.length} color="var(--danger)" />
            </div>

            {resumo.erros.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-[var(--t2)] font-semibold">
                  Ver detalhes dos {resumo.erros.length} erros
                </summary>
                <ul
                  className="mt-3 text-xs space-y-1.5"
                  style={{
                    background: 'var(--danger-soft)',
                    color: 'var(--danger)',
                    border: '1px solid var(--danger)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '10px 14px',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {resumo.erros.map(e => (
                    <li key={e.linha}>
                      <b>Linha {e.linha}:</b> {e.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => navigate('/municipios')}
                className="btn btn-primary"
              >
                Voltar para a lista
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: 'var(--card-bg-2)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 14,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      <div className="text-xs text-[var(--t3)] mt-1 uppercase tracking-wider font-semibold">
        {label}
      </div>
    </div>
  )
}
