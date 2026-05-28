import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

export function ensureDir(subdir: string) {
  const dir = path.join(UPLOADS_DIR, subdir)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function createUpload(subdir: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, ensureDir(subdir)),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, `${randomUUID()}${ext}`)
      },
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      if (ALLOWED_MIMES.includes(file.mimetype) && ALLOWED_EXTS.includes(ext)) {
        cb(null, true)
      } else {
        cb(Object.assign(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'), { status: 400 }))
      }
    },
  })
}

export function deleteFile(subdir: string, filename: string) {
  const baseDir = path.resolve(ensureDir(subdir))
  const filepath = path.resolve(baseDir, filename)
  if (!filepath.startsWith(baseDir + path.sep) && filepath !== baseDir) {
    throw Object.assign(new Error('Acesso negado'), { status: 403 })
  }
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
}
