import { it, expect } from 'vitest'
import { assetUrl } from './asset-url'

it('prefixa caminho /uploads com a base absoluta da API (prod)', () => {
  expect(assetUrl('/uploads/eventos/x.png', 'https://api.example.com')).toBe(
    'https://api.example.com/uploads/eventos/x.png',
  )
})

it('remove barra(s) final(is) da base antes de concatenar', () => {
  expect(assetUrl('/uploads/x.png', 'https://api.example.com/')).toBe(
    'https://api.example.com/uploads/x.png',
  )
})

it('mantém o caminho relativo quando a base é ausente ou relativa (dev)', () => {
  expect(assetUrl('/uploads/x.png', undefined)).toBe('/uploads/x.png')
  expect(assetUrl('/uploads/x.png', '/api')).toBe('/uploads/x.png')
})

it('passa direto URLs já absolutas e blob:/data:', () => {
  expect(assetUrl('https://cdn/x.png', 'https://api.example.com')).toBe('https://cdn/x.png')
  expect(assetUrl('blob:abc-123', 'https://api.example.com')).toBe('blob:abc-123')
  expect(assetUrl('data:image/png;base64,AAAA', 'https://api.example.com')).toBe('data:image/png;base64,AAAA')
})

it('null/undefined/vazio → undefined', () => {
  expect(assetUrl(null, 'https://api.example.com')).toBeUndefined()
  expect(assetUrl(undefined, 'https://api.example.com')).toBeUndefined()
  expect(assetUrl('', 'https://api.example.com')).toBeUndefined()
})
