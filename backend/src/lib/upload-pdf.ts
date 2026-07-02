import multer from 'multer'
import path from 'path'

const MAX = Number(process.env.MAX_PDF_BYTES ?? 26214400)

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (file.mimetype === 'application/pdf' && ext === '.pdf') cb(null, true)
    else cb(Object.assign(new Error('Apenas arquivos PDF são permitidos.'), { status: 400 }))
  },
})

const PDF_MAGIC = Buffer.from('%PDF')

export function assertPdf(buffer: Buffer): void {
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw Object.assign(new Error('Arquivo não é um PDF válido.'), { status: 400 })
  }
}

export function sanitizeFilename(nome: string): string {
  const limpo = nome
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 150)
  return limpo || 'boletim.pdf'
}
