import { useEffect, useRef, useState } from 'react'
import { FileText, Plus, Download, MoreHorizontal, X, Check, ChevronDown, Upload, Lock, Trash2 } from 'lucide-react'
import { boletinsService, type Boletim } from '../../services/boletins'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'

export default function EventoBoletins({ eventoId, eventoNome }: { eventoId: number; eventoNome?: string }) {
  const [docs, setDocs] = useState<Boletim[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [kebab, setKebab] = useState<number | null>(null)

  async function load() { setDocs(await boletinsService.listar(eventoId)) }
  useEffect(() => { load().catch(() => {}) }, [eventoId])
  useEffect(() => {
    const close = () => setKebab(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600) }

  async function onRemove(id: number) {
    setKebab(null)
    if (!confirm('Remover este boletim?')) return
    try { await boletinsService.remover(eventoId, id); await load() } catch { showToast('Falha ao remover') }
  }

  const ordenados = [...docs].sort((a, b) => b.numero - a.numero)

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <div className="bol-head">
        <div className="ic-tile"><FileText size={21} /></div>
        <div>
          <div className="eyebrow">Documentos do evento</div>
          <h3 className="sec-title" style={{ fontSize: 19 }}>Boletins</h3>
          <div className="count">{docs.length} publicado{docs.length === 1 ? '' : 's'}{eventoNome ? ` — ${eventoNome}` : ''}</div>
        </div>
        <div className="spacer" />
        <button className="btn btn-primary pub-btn" onClick={() => setModalOpen(true)}><Plus size={18} /> Publicar boletim</button>
      </div>

      {ordenados.length === 0 ? (
        <div className="bol-empty">
          <FileText size={28} />
          <div>Nenhum boletim publicado</div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={18} /> Publicar primeiro boletim</button>
        </div>
      ) : (
        <div className="bol-list">
          {ordenados.map((d) => {
            const info = categoriaInfo(d.categoria)
            return (
              <div className="bol-row" key={d.id}>
                <div className="pdf"><FileText size={16} /></div>
                <div className="body">
                  <div className="num">Nº {String(d.numero).padStart(3, '0')}</div>
                  <div className="ttl">{d.titulo}</div>
                  <div className="meta">
                    <span className={`badge ${info.badgeClass}`}>{info.label}</span>
                    <span className="sep" />{dataPtBr(d.data_publicacao)}
                    <span className="sep" />{formatBytes(d.size_bytes)}
                  </div>
                </div>
                <div className="right">
                  <div className="acts" onClick={(e) => e.stopPropagation()}>
                    <a className="ibtn-sm" href={d.public_url} target="_blank" rel="noopener noreferrer" title="Baixar"><Download size={17} /></a>
                    <button className="ibtn-sm" title="Mais" onClick={() => setKebab(kebab === d.id ? null : d.id)}><MoreHorizontal size={17} /></button>
                    {kebab === d.id && (
                      <div className="kebab-menu"><button onClick={() => onRemove(d.id)}><Trash2 size={15} /> Remover</button></div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <PublicarModal
          eventoId={eventoId}
          eventoNome={eventoNome}
          onClose={() => setModalOpen(false)}
          onPublished={async () => { setModalOpen(false); await load(); showToast('Boletim publicado') }}
        />
      )}

      {toast && (
        <div className="toast show"><span className="tk"><Check size={14} /></span> {toast}</div>
      )}
    </div>
  )
}

function PublicarModal({ eventoId, eventoNome, onClose, onPublished }: {
  eventoId: number; eventoNome?: string; onClose: () => void; onPublished: () => void
}) {
  const [numero, setNumero] = useState('')
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS_BOLETIM[0].value)
  const [data, setData] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [typeOpen, setTypeOpen] = useState(false)
  const [drag, setDrag] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const info = categoriaInfo(categoria)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!typeOpen) return
    const close = () => setTypeOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [typeOpen])

  function pick(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf') { setErro('Apenas arquivos PDF.'); return }
    setErro(null); setFile(f)
  }

  async function publicar() {
    if (!file || !numero || !titulo || !data) { setErro('Preencha número, título, data e arquivo.'); return }
    setLoading(true); setErro(null)
    try {
      await boletinsService.enviar(eventoId, { numero: Number(numero), titulo, categoria, data_publicacao: data, file })
      onPublished()
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao publicar')
    } finally { setLoading(false) }
  }

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="mh">
          <div className="mi"><FileText size={20} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="sec-title" style={{ fontSize: 16 }}>Publicar boletim</h3>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{eventoNome ?? ''}</div>
          </div>
          <button className="ibtn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mb">
          <div className="grid-num-title">
            <div className="field"><label>Número <span className="req">*</span></label><input className="lg-input" value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
            <div className="field"><label>Título <span className="req">*</span></label><input className="lg-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          </div>
          <div className="grid-tipo-data">
            <div className="field">
              <label>Tipo <span className="req">*</span></label>
              <div className="fake-select" onClick={(e) => { e.stopPropagation(); setTypeOpen((v) => !v) }}>
                <span className="swatch" style={{ background: info.swatch }} />
                <span>{info.label}</span>
                <ChevronDown size={16} className="chev" />
                {typeOpen && (
                  <div className="type-menu" onClick={(e) => e.stopPropagation()}>
                    {CATEGORIAS_BOLETIM.map((c) => (
                      <button key={c.value} className="type-opt" onClick={() => { setCategoria(c.value); setTypeOpen(false) }}>
                        <span className="swatch" style={{ background: c.swatch }} /> {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="field"><label>Data <span className="req">*</span></label>
              <input className="lg-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Arquivo PDF <span className="req">*</span></label>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="file-chip">
                <div className="pdf"><FileText size={14} /></div>
                <div><div className="name">{file.name}</div><div className="fmeta">{formatBytes(file.size)}</div></div>
                <button className="ibtn-sm x" onClick={() => setFile(null)}><X size={16} /></button>
              </div>
            ) : (
              <div
                className={`bol-drop${drag ? ' drag' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] ?? null) }}
              >
                <div className="dz-ic"><Upload size={21} /></div>
                <div><div className="t">Arraste o PDF ou clique para selecionar</div><div className="s">Apenas .pdf · até 25 MB</div></div>
              </div>
            )}
          </div>
          {erro && <p style={{ color: 'var(--danger, crimson)', fontSize: 12, margin: 0 }}>{erro}</p>}
        </div>
        <div className="mf">
          <span className="hint"><Lock size={13} /> Registrado em auditoria</span>
          <span className="grow" />
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={loading} onClick={publicar}><Check size={16} /> {loading ? 'Publicando…' : 'Publicar'}</button>
        </div>
      </div>
    </div>
  )
}
