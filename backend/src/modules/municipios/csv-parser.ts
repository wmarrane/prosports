export function parseCsv(input: string): Record<string, string>[] {
  let text = input
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const firstNewline = text.search(/\r?\n/)
  const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline)
  const sep = detectSeparator(firstLine)

  const rows = splitRows(text, sep)
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  const result: Record<string, string>[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length === 1 && row[0] === '') continue
    const obj: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (row[j] ?? '').trim()
    }
    result.push(obj)
  }
  return result
}

function detectSeparator(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return semis > commas ? ';' : ','
}

function splitRows(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === sep) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); field = ''; row = []; continue }
    field += ch
  }
  row.push(field)
  if (!(row.length === 1 && row[0] === '')) rows.push(row)
  return rows
}
