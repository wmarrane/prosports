import { SftpStorage } from './sftp'
import { GcsStorage } from './gcs'
import { LocalStorage } from './local'

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
  } else if (provider === 'local') {
    cached = new LocalStorage()
  } else {
    cached = new SftpStorage()
  }
  return cached
}
