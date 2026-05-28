import { useQuery } from '@tanstack/react-query'
import { parseChangelog, type Release } from './changelog'

async function fetchChangelog(): Promise<Release[]> {
  const res = await fetch('/CHANGELOG.md', { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Falha ao carregar CHANGELOG (${res.status})`)
  const text = await res.text()
  return parseChangelog(text)
}

export function useChangelog() {
  return useQuery({
    queryKey: ['changelog'],
    queryFn: fetchChangelog,
    staleTime: Infinity,
  })
}
