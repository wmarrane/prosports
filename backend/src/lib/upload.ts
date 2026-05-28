import multer from 'multer'
import path from 'path'
import { randomUUID } from 'crypto'
import fs from 'fs'

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')

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
      const allowed = ['image/jpeg', 'image/png', 'image/webp']
      if (allowed.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(Object.assign(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'), { status: 400 }))
      }
    },
  })
}

export function deleteFile(subdir: string, filename: string) {
  const filepath = path.join(UPLOADS_DIR, subdir, filename)
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
}
