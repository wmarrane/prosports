import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { municipiosService } from '../../services/municipios'
import type { ImportResumo } from '../../types/municipio'

export default function MunicipiosImport() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [resumo, setResumo] = useState<ImportResumo | null>(null)
  const [erro, setErro] = useState('')

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: () => municipiosService.importar(file!),
    onSuccess: (r) => {
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

  return (
    <div className="text-white">
      <PageHeader title="Importar Municípios" backTo="/municipios" />
      <div className="p-6 max-w-2xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-400">
            Envie um arquivo CSV (UTF-8) com as colunas <strong>Código Município Completo</strong>, <strong>Nome_Município</strong> e <strong>Nome_UF</strong> (ou os aliases <code>codigo_ibge</code>, <code>nome</code>, <code>uf</code>). Municípios são atualizados pelo código IBGE.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
          />
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={!file || isPending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
              {isPending ? 'Enviando...' : 'Enviar'}
            </button>
            <button type="button" onClick={() => navigate('/municipios')} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg">
              Cancelar
            </button>
          </div>
        </form>

        {resumo && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
            <p>✅ <strong>{resumo.criados}</strong> criados</p>
            <p>♻️ <strong>{resumo.atualizados}</strong> atualizados</p>
            <p>➖ <strong>{resumo.ignorados}</strong> ignorados (sem alteração)</p>
            <p>⚠️ <strong>{resumo.erros.length}</strong> erros</p>
            {resumo.erros.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-gray-400">Ver erros</summary>
                <ul className="mt-2 text-xs text-red-300 space-y-1">
                  {resumo.erros.map((e) => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
