import fs from 'fs'
import path from 'path'
import SftpClient from 'ssh2-sftp-client'
import type { StorageProvider } from './index'

export class SftpStorage implements StorageProvider {
  private host = process.env.SFTP_HOST!
  private port = Number(process.env.SFTP_PORT ?? 22)
  private username = process.env.SFTP_USER!
  private keyPath = process.env.SFTP_PRIVATE_KEY_PATH
  private baseDir = process.env.SFTP_BASE_DIR ?? '/srv/boletins'
  private baseUrl = process.env.PUBLIC_BOLETINS_BASE_URL!

  private async withClient<T>(fn: (c: SftpClient) => Promise<T>): Promise<T> {
    const c = new SftpClient()
    await c.connect({
      host: this.host, port: this.port, username: this.username,
      privateKey: this.keyPath ? fs.readFileSync(this.keyPath) : undefined,
    })
    try { return await fn(c) } finally { await c.end() }
  }

  async put(objectKey: string, buffer: Buffer, _contentType: string): Promise<string> {
    await this.withClient(async (c) => {
      const remote = path.posix.join(this.baseDir, objectKey)
      const dir = path.posix.dirname(remote)
      if (!(await c.exists(dir))) await c.mkdir(dir, true)
      await c.put(buffer, remote)
    })
    return `${this.baseUrl}/${objectKey}`
  }

  async remove(objectKey: string): Promise<void> {
    await this.withClient(async (c) => {
      const remote = path.posix.join(this.baseDir, objectKey)
      if (await c.exists(remote)) await c.delete(remote)
    })
  }
}
