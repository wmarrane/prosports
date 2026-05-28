import { useCallback, useEffect, useState } from 'react'
import { APP_VERSION } from './version'

const KEY = 'prosports:ultima-versao-vista'

export function useNovidades() {
  const [temNovidade, setTemNovidade] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored === null) {
      // primeiro acesso: registra a versão atual sem mostrar badge
      localStorage.setItem(KEY, APP_VERSION)
      setTemNovidade(false)
      return
    }
    setTemNovidade(stored !== APP_VERSION)
  }, [])

  const marcarComoVisto = useCallback(() => {
    localStorage.setItem(KEY, APP_VERSION)
    setTemNovidade(false)
  }, [])

  return { temNovidade, marcarComoVisto }
}
