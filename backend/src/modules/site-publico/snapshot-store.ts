import * as github from './github'
import { putSnapshotLocal, deleteSnapshotLocal, buildLocal } from './local-store'

function localDir(): string | undefined {
  const d = process.env.SITE_SNAPSHOT_LOCAL_DIR
  return d && d.trim() !== '' ? d.trim() : undefined
}

export async function putSnapshot(eventoId: number, snapshot: unknown): Promise<void> {
  const dir = localDir()
  if (dir) return putSnapshotLocal(dir, eventoId, snapshot)
  return github.putSnapshot(eventoId, snapshot)
}

export async function deleteSnapshot(eventoId: number): Promise<void> {
  const dir = localDir()
  if (dir) return deleteSnapshotLocal(dir, eventoId)
  return github.deleteSnapshot(eventoId)
}

export async function dispatchBuild(): Promise<void> {
  const dir = localDir()
  if (dir) return buildLocal(dir)
  return github.dispatchBuild()
}
