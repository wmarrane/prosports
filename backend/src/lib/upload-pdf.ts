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
