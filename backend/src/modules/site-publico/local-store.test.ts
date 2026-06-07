import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { putSnapshotLocal, deleteSnapshotLocal } from './local-store'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'snap-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

it('putSnapshotLocal escreve evento-<id>.json com JSON identado', async () => {
  await putSnapshotLocal(dir, 10, { a: 1 })
  const file = join(dir, 'evento-10.json')
  expect(existsSync(file)).toBe(true)
  const content = readFileSync(file, 'utf8')
  expect(content).toContain('"a": 1')           // pretty (2-space) JSON
  expect(JSON.parse(content)).toEqual({ a: 1 })
})

it('putSnapshotLocal cria o diretorio se nao existir', async () => {
  const nested = join(dir, 'sub', 'dir')
  await putSnapshotLocal(nested, 5, { x: true })
  expect(existsSync(join(nested, 'evento-5.json'))).toBe(true)
})

it('deleteSnapshotLocal remove o arquivo e nao falha se ausente', async () => {
  await putSnapshotLocal(dir, 7, {})
  expect(existsSync(join(dir, 'evento-7.json'))).toBe(true)
  await deleteSnapshotLocal(dir, 7)
  expect(existsSync(join(dir, 'evento-7.json'))).toBe(false)
  await deleteSnapshotLocal(dir, 7) // segunda vez: idempotente, nao lanca
})
