import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

export default function GlobalLoadingBar() {
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const ativo = fetching + mutating > 0
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (ativo) {
      const t = setTimeout(() => setVisivel(true), 120)
      return () => clearTimeout(t)
    }
    setVisivel(false)
  }, [ativo])

  if (!visivel) return null

  return (
    <div className="global-loading-bar" role="progressbar" aria-label="Carregando" aria-busy="true">
      <div className="global-loading-bar-inner" />
    </div>
  )
}
