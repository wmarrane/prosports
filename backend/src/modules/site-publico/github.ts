const API = 'https://api.github.com'

function cfg() {
  const pat = process.env.GITHUB_PAT
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_SNAPSHOT_BRANCH ?? 'develop'
  if (!pat || !repo) {
    throw Object.assign(new Error('GITHUB_PAT/GITHUB_REPO não configurados'), { status: 500 })
  }
  return { pat, repo, branch }
}

function headers(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

function snapshotPath(eventoId: number) {
  return `frontend/public-site-snapshots/evento-${eventoId}.json`
}

async function getSha(repo: string, path: string, branch: string, pat: string): Promise<string | undefined> {
  const r = await fetch(`${API}/repos/${repo}/contents/${path}?ref=${branch}`, {
    method: 'GET', headers: headers(pat),
  })
  if (r.status === 404) return undefined
  if (!r.ok) throw Object.assign(new Error(`GitHub getSha ${r.status}`), { status: 502 })
  const json = (await r.json()) as { sha: string }
  return json.sha
}

export async function putSnapshot(eventoId: number, snapshot: unknown): Promise<void> {
  const { pat, repo, branch } = cfg()
  const path = snapshotPath(eventoId)
  const sha = await getSha(repo, path, branch, pat)
  const content = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8').toString('base64')
  const body: Record<string, unknown> = {
    message: `chore(site): snapshot evento ${eventoId} [skip auto-bump]`,
    content, branch,
  }
  if (sha) body.sha = sha
  const r = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT', headers: headers(pat), body: JSON.stringify(body),
  })
  if (!r.ok) throw Object.assign(new Error(`GitHub putSnapshot ${r.status}`), { status: 502 })
}

export async function deleteSnapshot(eventoId: number): Promise<void> {
  const { pat, repo, branch } = cfg()
  const path = snapshotPath(eventoId)
  const sha = await getSha(repo, path, branch, pat)
  if (!sha) return
  const r = await fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'DELETE', headers: headers(pat),
    body: JSON.stringify({ message: `chore(site): remove snapshot evento ${eventoId} [skip auto-bump]`, sha, branch }),
  })
  if (!r.ok) throw Object.assign(new Error(`GitHub deleteSnapshot ${r.status}`), { status: 502 })
}

export async function dispatchBuild(): Promise<void> {
  const { pat, repo } = cfg()
  const r = await fetch(`${API}/repos/${repo}/dispatches`, {
    method: 'POST', headers: headers(pat),
    body: JSON.stringify({ event_type: 'publicar-site' }),
  })
  if (!r.ok) throw Object.assign(new Error(`GitHub dispatch ${r.status}`), { status: 502 })
}
