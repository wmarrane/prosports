import { SftpStorage } from './sftp'
import { GcsStorage } from './gcs'

export interface StorageProvider {
  put(objectKey: string, buffer: Buffer, contentType: string): Promise<string>
  remove(objectKey: string): Promise<void>
}

let cached: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (cached) return cached
  const provider = process.env.STORAGE_PROVIDER ?? 'sftp'
  if (provider === 'gcs') {
    cached = new GcsStorage()
  } else {
    cached = new SftpStorage()
  }
  return cached
}
