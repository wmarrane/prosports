import { it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

// Cada caso reimporta `./index` (vi.resetModules), e esse módulo arrasta o SDK do
// Google Cloud via `./gcs`. Com a suíte inteira em paralelo isso passa dos 5s
// padrão do vitest e o teste falha por timeout, não por lógica.
const IMPORT_TIMEOUT = 20_000

let tmp: string

beforeEach(async () => {
  vi.resetModules()
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'prosports-storage-'))
  process.env.STORAGE_PROVIDER = 'local'
  process.env.UPLOADS_DIR = tmp
  delete process.env.PUBLIC_BOLETINS_BASE_URL
}, IMPORT_TIMEOUT)

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true })
}, IMPORT_TIMEOUT)

it('getStorage retorna LocalStorage quando STORAGE_PROVIDER=local', async () => {
  const { getStorage } = await import('./index')
  const { LocalStorage } = await import('./local')
  expect(getStorage()).toBeInstanceOf(LocalStorage)
}, IMPORT_TIMEOUT)

it('put grava sob uploads/boletins e devolve a URL servida pela rota /uploads', async () => {
  const { getStorage } = await import('./index')
  const url = await getStorage().put('eventos/9/boletim-1-abc.pdf', Buffer.from('pdf'), 'application/pdf')

  expect(url).toBe('/uploads/boletins/eventos/9/boletim-1-abc.pdf')
  const gravado = await fs.readFile(path.join(tmp, 'boletins', 'eventos', '9', 'boletim-1-abc.pdf'), 'utf8')
  expect(gravado).toBe('pdf')
}, IMPORT_TIMEOUT)

it('PUBLIC_BOLETINS_BASE_URL sobrepõe a base da URL', async () => {
  process.env.PUBLIC_BOLETINS_BASE_URL = 'http://localhost:3100/uploads/boletins'
  const { getStorage } = await import('./index')
  const url = await getStorage().put('eventos/9/b.pdf', Buffer.from('x'), 'application/pdf')
  expect(url).toBe('http://localhost:3100/uploads/boletins/eventos/9/b.pdf')
}, IMPORT_TIMEOUT)

it('PUBLIC_BOLETINS_BASE_URL VAZIA cai no default (o compose passa a var vazia)', async () => {
  process.env.PUBLIC_BOLETINS_BASE_URL = ''
  const { getStorage } = await import('./index')
  const url = await getStorage().put('eventos/9/b.pdf', Buffer.from('x'), 'application/pdf')
  expect(url).toBe('/uploads/boletins/eventos/9/b.pdf')
}, IMPORT_TIMEOUT)

it('remove apaga o arquivo e é idempotente', async () => {
  const { getStorage } = await import('./index')
  const s = getStorage()
  await s.put('eventos/9/b.pdf', Buffer.from('x'), 'application/pdf')
  const alvo = path.join(tmp, 'boletins', 'eventos', '9', 'b.pdf')

  await s.remove('eventos/9/b.pdf')
  await expect(fs.access(alvo)).rejects.toThrow()
  await expect(s.remove('eventos/9/b.pdf')).resolves.toBeUndefined()
}, IMPORT_TIMEOUT)

it('objectKey com path traversal é rejeitado', async () => {
  const { getStorage } = await import('./index')
  await expect(getStorage().put('../../fora.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow()
  await expect(getStorage().remove('../../fora.pdf')).rejects.toThrow()
}, IMPORT_TIMEOUT)
