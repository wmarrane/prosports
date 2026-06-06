import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { putSnapshot, deleteSnapshot, dispatchBuild } from './github'

const realFetch = globalThis.fetch
beforeEach(() => {
  process.env.GITHUB_PAT = 'tok'
  process.env.GITHUB_REPO = 'owner/repo'
  process.env.GITHUB_SNAPSHOT_BRANCH = 'develop'
})
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks() })

it('putSnapshot cria arquivo novo (sem sha) com conteudo base64', async () => {
  const calls: any[] = []
  globalThis.fetch = vi.fn(async (url: any, opts: any) => {
    calls.push({ url: String(url), opts })
    if (opts.method === 'GET') return new Response('', { status: 404 })
    return new Response(JSON.stringify({ content: { sha: 'newsha' } }), { status: 201 })
  }) as any

  await putSnapshot(10, { hello: 'world' })

  const put = calls.find((c) => c.opts.method === 'PUT')
  expect(put.url).toContain('/contents/frontend/public-site-snapshots/evento-10.json')
  const body = JSON.parse(put.opts.body)
  expect(body.branch).toBe('develop')
  expect(Buffer.from(body.content, 'base64').toString('utf8')).toContain('"hello"')
  expect(body.sha).toBeUndefined()
})

it('putSnapshot envia sha quando arquivo ja existe', async () => {
  globalThis.fetch = vi.fn(async (url: any, opts: any) => {
    if (opts.method === 'GET') return new Response(JSON.stringify({ sha: 'oldsha' }), { status: 200 })
    return new Response(JSON.stringify({ content: { sha: 'newsha' } }), { status: 200 })
  }) as any
  const spy = globalThis.fetch as any
  await putSnapshot(10, { a: 1 })
  const putBody = JSON.parse(spy.mock.calls.find((c: any) => c[1].method === 'PUT')[1].body)
  expect(putBody.sha).toBe('oldsha')
})

it('dispatchBuild faz POST em /dispatches com event_type', async () => {
  let url = '', body: any
  globalThis.fetch = vi.fn(async (u: any, o: any) => { url = String(u); body = JSON.parse(o.body); return new Response(null, { status: 204 }) }) as any
  await dispatchBuild()
  expect(url).toContain('/dispatches')
  expect(body.event_type).toBe('publicar-site')
})
