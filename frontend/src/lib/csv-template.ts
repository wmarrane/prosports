/**
 * Utilitário para gerar e baixar templates CSV.
 *
 * O CSV gerado é UTF-8 com BOM (para Excel reconhecer caracteres acentuados)
 * e usa vírgula como separador. Headers na primeira linha, dados de exemplo
 * nas linhas seguintes.
 *
 * Padrão: para escapar campos com vírgula/aspas/quebra de linha, usa RFC 4180
 * (envolve em "..." e duplica aspas internas).
 */

import { csvCell } from './csv-safe'

function escape(value: string | number | null | undefined): string {
  return csvCell(value)
}

export type CsvTemplate = {
  filename: string
  headers: string[]
  exampleRows: Array<Array<string | number | null>>
}

/**
 * Gera o conteúdo CSV (string) e dispara o download no browser.
 *
 * UTF-8 com BOM (﻿) para compatibilidade com Excel pt-BR.
 */
export function downloadCsvTemplate(template: CsvTemplate): void {
  const lines: string[] = []
  lines.push(template.headers.map(escape).join(','))
  for (const row of template.exampleRows) {
    lines.push(row.map(escape).join(','))
  }
  const csv = '﻿' + lines.join('\r\n') + '\r\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = template.filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
