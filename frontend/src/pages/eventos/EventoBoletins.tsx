import { useEffect, useState } from 'react'
import { boletinsService, type Boletim } from '../../services/boletins'

const CATEGORIAS = ['Resultados', 'Comunicado', 'Tabela', 'Regulamento', 'Outros']

export default function EventoBoletins({ eventoId }: { eventoId: number }) {
  const [docs, setDocs] = useState<Boletim[]>([])
  const [numero, setNumero] = useState('')
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS[0])
  const [data, setData] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function load() { setDocs(await boletinsService.listar(eventoId)) }
  useEffect(() => { load() }, [eventoId])

  async function onUpload() {
    if (!file || !numero || !titulo || !data) { setErro('Preencha número, título, data e arquivo.'); return }
    setLoading(true); setErro(null)
    try {
      await boletinsService.enviar(eventoId, { numero: Number(numero), titulo, categoria, data_publicacao: data, file })
      setNumero(''); setTitulo(''); setData(''); setFile(null)
      await load()
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha no upload')
    } finally { setLoading(false) }
  }

  async function onDelete(id: number) {
    if (!confirm('Remover este boletim?')) return
    await boletinsService.remover(eventoId, id)
    await load()
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h3>Boletins</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'end' }}>
        <input placeholder="Nº" value={numero} onChange={e => setNumero(e.target.value)} style={{ width: 70 }} />
        <input placeholder="Título" value={titulo} onChange={e => setTitulo(e.target.value)} />
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={data} onChange={e => setData(e.target.value)} />
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <button disabled={loading} onClick={onUpload}>{loading ? 'Enviando…' : 'Publicar PDF'}</button>
      </div>
      {erro && <p style={{ color: 'crimson' }}>{erro}</p>}
      <ul>
        {docs.map(d => (
          <li key={d.id}>
            <strong>{String(d.numero).padStart(2, '0')}</strong> — {d.titulo} <em>[{d.categoria}]</em>{' '}
            <a href={d.public_url} target="_blank" rel="noopener">PDF</a>{' '}
            <button onClick={() => onDelete(d.id)}>Remover</button>
          </li>
        ))}
        {docs.length === 0 && <li>Nenhum boletim publicado.</li>}
      </ul>
    </section>
  )
}
