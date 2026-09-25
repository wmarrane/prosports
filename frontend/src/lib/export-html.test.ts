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

describe('documento exportado — o que o PDF depende', () => {
  // O "Exportar PDF" é este mesmo documento passando pelo diálogo de impressão.
  // Se estas regras saírem do CSS, o PDF vira um bolo sem quebra de página e
  // ninguém percebe até imprimir.
  const html = buildExportDocument({ titulo: 'Jogos', css: '', bodyHtml: '<div class="sorteio-print">x</div>' })

  it('quebra uma página por modalidade na impressão', () => {
    expect(html).toContain('@media print')
    expect(html.replace(/\s+/g, ' ')).toContain('.sorteio-print { page-break-after: always; }')
  })

  it('não quebra página depois da última modalidade nem do cabeçalho', () => {
    const limpo = html.replace(/\s+/g, ' ')
    expect(limpo).toContain('.sorteio-print:last-child { page-break-after: auto; }')
    expect(limpo).toContain('.export-header { page-break-after: auto !important; }')
  })

  it('leva o nome do evento no título, que vira o nome do arquivo salvo', () => {
    expect(buildExportDocument({ titulo: '88ª Jogos Abertos', css: '', bodyHtml: '' }))
      .toContain('<title>88ª Jogos Abertos</title>')
  })
})
