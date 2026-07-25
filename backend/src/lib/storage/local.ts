import fs from 'fs/promises'
import path from 'path'
import type { StorageProvider } from './index'

/**
 * Storage de DESENVOLVIMENTO: grava no diretório de uploads do próprio backend
 * (servido pela rota estática `/uploads`), sem depender do SFTP nem do GCS.
 * Permite rodar o ambiente inteiro no Docker Desktop sem a VM de boletins.
 * Em produção continue usando `gcs` — aqui não há CDN nem durabilidade.
 */
export class LocalStorage implements StorageProvider {
  private baseDir = path.join(
    process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads'),
    'boletins',
  )
  // Relativa por padrão: o admin serve `/uploads` na mesma origem (proxy do nginx).
  // `||` (e não `??`) de propósito: no compose a variável pode chegar VAZIA.
  private baseUrl = process.env.PUBLIC_BOLETINS_BASE_URL || '/uploads/boletins'

  /** Resolve o destino garantindo que a chave não escape do baseDir. */
  private caminho(objectKey: string): string {
    const full = path.resolve(this.baseDir, objectKey)
    if (full !== this.baseDir && !full.startsWith(this.baseDir + path.sep)) {
      throw Object.assign(new Error('objectKey inválido'), { status: 400 })
    }
    return full
  }

  async put(objectKey: string, buffer: Buffer, _contentType: string): Promise<string> {
    const full = this.caminho(objectKey)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, buffer)
    return `${this.baseUrl}/${encodeURI(objectKey)}`
  }

  async remove(objectKey: string): Promise<void> {
    await fs.rm(this.caminho(objectKey), { force: true })
  }
}
