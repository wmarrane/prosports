import { describe, it, expect } from 'vitest'
import { slugify, buildExportDocument } from './export-html'

describe('slugify', () => {
  it('normaliza acentos e espacos', () => {
    expect(slugify('São Manuel 2026')).toBe('sao-manuel-2026')
  })
  it('string sem caracteres validos vira "evento"', () => {
    expect(slugify('!!!')).toBe('evento')
  })
})

describe('buildExportDocument', () => {
  it('inclui titulo, css serializado, override, tema claro e corpo', () => {
    const html = buildExportDocument({
      titulo: 'Jogos',
      css: '.x{color:red}',
      bodyHtml: '<div class="sorteio-print">ok</div>',
    })
    expect(html).toContain('<title>Jogos</title>')
    expect(html).toContain('data-theme="light"')
    expect(html).toContain('.x{color:red}')
    expect(html).toContain('.sorteio-print { display: block !important; }')
    expect(html).toContain('overflow: visible !important')
    expect(html).toContain('<div class="sorteio-print">ok</div>')
  })
  it('escapa caracteres especiais no titulo', () => {
    const html = buildExportDocument({ titulo: 'A & B <2026>', css: '', bodyHtml: '' })
    expect(html).toContain('<title>A &amp; B &lt;2026&gt;</title>')
  })
})
