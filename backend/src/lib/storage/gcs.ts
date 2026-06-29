import { Storage } from '@google-cloud/storage'
import type { StorageProvider } from './index'

export class GcsStorage implements StorageProvider {
  private storage = new Storage() // ADC (SA da VM); sem key file
  private bucketName = process.env.GCS_DOCS_BUCKET!
  private baseUrl = process.env.PUBLIC_DOCS_BASE_URL!

  async put(objectKey: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.storage.bucket(this.bucketName).file(objectKey).save(buffer, {
      contentType, resumable: false, metadata: { cacheControl: 'public, max-age=3600' },
    })
    return `${this.baseUrl}/${encodeURI(objectKey)}`
  }

  async remove(objectKey: string): Promise<void> {
    await this.storage.bucket(this.bucketName).file(objectKey).delete({ ignoreNotFound: true })
  }
}
