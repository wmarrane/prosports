import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

function snapshotFile(dir: string, eventoId: number): string {
  return path.join(dir, `evento-${eventoId}.json`)
}

export async function putSnapshotLocal(dir: string, eventoId: number, snapshot: unknown): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(snapshotFile(dir, eventoId), JSON.stringify(snapshot, null, 2), 'utf8')
}

export async function deleteSnapshotLocal(dir: string, eventoId: number): Promise<void> {
  await rm(snapshotFile(dir, eventoId), { force: true })
}

export async function buildLocal(dir: string): Promise<void> {
  // dir é `<...>/frontend/public-site-snapshots`; o frontend é o diretório pai.
  const frontendDir = path.dirname(dir)
  await new Promise<void>((resolve) => {
    const child = spawn('npm', ['run', 'build:site'], { cwd: frontendDir, shell: true })
    let out = ''
    let err = ''
    child.stdout?.on('data', (d) => { out += d.toString() })
    child.stderr?.on('data', (d) => { err += d.toString() })
    child.on('error', (e) => {
      console.error(`[site-publico] build:site falhou ao iniciar em ${frontendDir}:`, e)
      resolve()
    })
    child.on('close', (code) => {
      if (out.trim()) console.log(`[site-publico] build:site stdout:\n${out.trim()}`)
      if (code === 0) {
        console.log(`[site-publico] build:site concluído (exit 0) em ${frontendDir}`)
      } else {
        if (err.trim()) console.error(`[site-publico] build:site stderr:\n${err.trim()}`)
        console.error(`[site-publico] build:site terminou com exit ${code} em ${frontendDir} (snapshot já gravado)`)
      }
      resolve()
    })
  })
}
