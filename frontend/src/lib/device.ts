const FP_KEY = 'prosports.device_fp'

export function getDeviceFingerprint(): string {
  let fp = localStorage.getItem(FP_KEY)
  if (!fp) {
    fp = (crypto.randomUUID?.() ?? `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem(FP_KEY, fp)
  }
  return fp
}

export function getDeviceLabel(): string {
  const ua = navigator.userAgent
  // Detecção simples: SO + browser
  const os =
    /iPhone|iPad/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Desconhecido'
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'
  return `${os} ${browser}`
}
