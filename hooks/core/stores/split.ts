// Minimal CSV/TSV split. Quoted commas stay in the cell.

export function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? ''
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else quoted = false
      } else cur += ch
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === delimiter) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

export function tableOf(text: string): string[][] | null {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  if (lines.length === 0) return null
  const sample = lines.slice(0, 8).join('\n')
  const tabs = sample.split('\t').length
  const commas = sample.split(',').length
  if (tabs < 2 && commas < 2) return null
  const delimiter = tabs > commas ? '\t' : ','
  const rows = lines.map((line) => splitLine(line, delimiter)).filter((row) => row.some(Boolean))
  return rows.length > 0 ? rows : null
}

export function cell(headers: string[], names: string[]): number {
  const folded = headers.map((header) => header.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  for (const name of names) {
    const at = folded.indexOf(name.toLowerCase().replace(/[\s-]+/g, '_'))
    if (at >= 0) return at
  }
  return -1
}

export function looksLikeHeader(headers: string[]): boolean {
  return cell(headers, [
    'probe_id', 'probe', 'cpg', 'ilmnid', 'beta', 'genus', 'relative_abundance', 'taxon',
    'uniprot', 'accession', 'symbol', 'gene', 'aptamer', 'seqid', 'unit_or_z', 'panel',
    'icd10', 'icd_10', 'code', 'display', 'onset', 'system', 'marker', 'sample_date',
  ]) >= 0
}

export function csvCell(value: string): string {
  if (/[",\n\r\t]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function formatNum(value: number): string {
  const text = value.toFixed(8).replace(/\.?0+$/, '')
  return text === '-0' || text === '' ? '0' : text
}
