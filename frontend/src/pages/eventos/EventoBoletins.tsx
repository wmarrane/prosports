import { useEffect, useRef, useState } from 'react'
import { FileText, Plus, Download, MoreHorizontal, X, Check, ChevronDown, Upload, Lock, Trash2, RefreshCw } from 'lucide-react'
import { boletinsService, type Boletim } from '../../services/boletins'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function EventoBoletins({ eventoId, eventoNome }: { eventoId: number; eventoNome?: string }) {
  const [docs, setDocs] = useState<Boletim[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Boletim | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [kebab, setKebab] = useState<number | null>(null)
  const [alvoRemover, setAlvoRemover] = useState<Boletim | null>(null)

  async function load() { setDocs(await boletinsService.listar(eventoId)) }
  useEffect(() => { load().catch(() => {}) }, [eventoId])
  useEffect(() => {
    const close = () => setKebab(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600) }

  async function confirmarRemover() {
    if (!alvoRemover) return
    try {
      await boletinsService.remover(eventoId, alvoRemover.id)
      await load()
      showToast('Boletim removido')
    } catch {
      showToast('Falha ao remover')
      throw new Error('falha ao remover')
    }
  }

  // mais recentemente publicado/reprocessado no topo
  const ordenados = [...docs].sort((a, b) => (+new Date(b.atualizado_em) - +new Date(a.atualizado_em)) || (b.numero - a.numero))

  function abrirPublicar() { setEditing(null); setModalOpen(true) }
  function abrirSubstituir(b: Boletim) { setKebab(null); setEditing(b); setModalOpen(true) }

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
        <button className="btn btn-primary pub-btn" onClick={abrirPublicar}><Plus size={18} /> Publicar boletim</button>
      </div>

      {ordenados.length === 0 ? (
        <div className="bol-empty">
          <FileText size={28} />
          <div>Nenhum boletim publicado</div>
          <button className="btn btn-primary" onClick={abrirPublicar}><Plus size={18} /> Publicar primeiro boletim</button>
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
                      <div className="kebab-menu">
                        <button onClick={() => abrirSubstituir(d)}><RefreshCw size={15} /> Substituir</button>
                        <button onClick={() => { setKebab(null); setAlvoRemover(d) }}><Trash2 size={15} /> Remover</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <BoletimModal
          eventoId={eventoId}
          eventoNome={eventoNome}
          boletim={editing}
          onClose={() => setModalOpen(false)}
          onDone={async (msg) => { setModalOpen(false); await load(); showToast(msg) }}
        />
      )}

      <ConfirmDialog
        open={alvoRemover !== null}
        onClose={() => setAlvoRemover(null)}
        onConfirm={confirmarRemover}
        eyebrow="Remover boletim"
        title={alvoRemover ? `Nº ${String(alvoRemover.numero).padStart(3, '0')} — ${alvoRemover.titulo}` : ''}
        description="O arquivo será removido do site público. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />

      {toast && (
        <div className="toast show"><span className="tk"><Check size={14} /></span> {toast}</div>
      )}
    </div>
  )
}

function BoletimModal({ eventoId, eventoNome, boletim, onClose, onDone }: {
  eventoId: number; eventoNome?: string; boletim: Boletim | null; onClose: () => void; onDone: (msg: string) => void
}) {
  const isEdit = boletim != null
  const [numero, setNumero] = useState(boletim ? String(boletim.numero) : '')
  const [titulo, setTitulo] = useState(boletim?.titulo ?? '')
  const [categoria, setCategoria] = useState(boletim?.categoria ?? CATEGORIAS_BOLETIM[0].value)
  const [data, setData] = useState(boletim ? boletim.data_publicacao.slice(0, 10) : '')
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

  async function salvar() {
    if (!titulo || !data) { setErro('Preencha título e data.'); return }
    if (!isEdit && (!file || !numero)) { setErro('Preencha número e arquivo.'); return }
    setLoading(true); setErro(null)
    try {
      if (isEdit) {
        await boletinsService.substituir(eventoId, boletim!.id, { titulo, categoria, data_publicacao: data, file: file ?? undefined })
        onDone('Boletim atualizado')
      } else {
        await boletinsService.enviar(eventoId, { numero: Number(numero), titulo, categoria, data_publicacao: data, file: file! })
        onDone('Boletim publicado')
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao salvar')
    } finally { setLoading(false) }
  }

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="mh">
          <div className="mi"><FileText size={20} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="sec-title" style={{ fontSize: 16 }}>{isEdit ? 'Substituir boletim' : 'Publicar boletim'}</h3>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{eventoNome ?? ''}</div>
          </div>
          <button className="ibtn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mb">
          <div className="grid-num-title">
            <div className="field"><label>Número {!isEdit && <span className="req">*</span>}</label>
              <input className="lg-input" value={numero} onChange={(e) => setNumero(e.target.value)} disabled={isEdit} />
            </div>
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
            <label>{isEdit ? 'Trocar PDF (opcional)' : <>Arquivo PDF <span className="req">*</span></>}</label>
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
                <div><div className="t">{isEdit ? 'Arraste um novo PDF ou mantenha o atual' : 'Arraste o PDF ou clique para selecionar'}</div><div className="s">Apenas .pdf · até 25 MB</div></div>
              </div>
            )}
          </div>
          {erro && <p style={{ color: 'var(--danger, crimson)', fontSize: 12, margin: 0 }}>{erro}</p>}
        </div>
        <div className="mf">
          <span className="hint"><Lock size={13} /> Registrado em auditoria</span>
          <span className="grow" />
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={loading} onClick={salvar}><Check size={16} /> {loading ? 'Salvando…' : (isEdit ? 'Salvar' : 'Publicar')}</button>
        </div>
      </div>
    </div>
  )
}
