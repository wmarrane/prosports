import { describe, it, expect, vi, beforeEach } from 'vitest'

const putMock = vi.fn()
const deleteMock = vi.fn()
const connectMock = vi.fn()
const endMock = vi.fn()
const mkdirMock = vi.fn()
vi.mock('ssh2-sftp-client', () => ({
  default: class { connect = connectMock; put = putMock; delete = deleteMock; end = endMock; mkdir = mkdirMock; exists = vi.fn().mockResolvedValue(false) },
}))

beforeEach(() => { vi.clearAllMocks(); vi.resetModules()
  process.env.STORAGE_PROVIDER = 'sftp'
  process.env.SFTP_HOST = 'h'; process.env.SFTP_USER = 'u'
  process.env.SFTP_PRIVATE_KEY_PATH = ''; process.env.SFTP_BASE_DIR = '/srv/boletins'
  process.env.PUBLIC_BOLETINS_BASE_URL = 'http://vm/boletins'
})

it('getStorage retorna SftpStorage quando STORAGE_PROVIDER=sftp', async () => {
  const { getStorage } = await import('./index')
  const s = getStorage()
  expect(s).toBeTruthy()
})

it('SftpStorage.put envia o buffer e retorna a URL pública', async () => {
  const { getStorage } = await import('./index')
  const url = await getStorage().put('eventos/9/boletim-1-abc.pdf', Buffer.from('x'), 'application/pdf')
  expect(putMock).toHaveBeenCalled()
  expect(url).toBe('http://vm/boletins/eventos/9/boletim-1-abc.pdf')
  expect(endMock).toHaveBeenCalled()
})
