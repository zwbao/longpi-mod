// How a record grows in Claude Code: Claude reads a checkup PDF or photo itself and files each value here, as
// printed, into the record on this computer (core/local-record.ts), which every LongPi method then reads.
// Wearable and app exports come in as a CSV. Registered beside the core's own tools.

import { existsSync, readFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import type { HostContext } from '../sys/cordis.ts'
import { defineTool } from '../sys/dsh-tools.ts'
import { asJson } from '../core/json.ts'
import { readLocalRecord, RECORD_FILE, writeLocalRecord, type LocalRecord, type Observation } from '../core/local-record.ts'
import { resolveDataDir } from '../core/paths.ts'
import { isoDay } from '../core/interventions.ts'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const SOURCES = ['checkup', 'lab', 'device', 'self', 'import'] as const

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
}

type Item = { name?: unknown; value?: unknown; unit?: unknown; loinc?: unknown; ref_low?: unknown; ref_high?: unknown; flag?: unknown; date?: unknown; time?: unknown }

function text(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

/** The series a value joins: an indicator already filed under the same LOINC code, else its printed name. */
function indicatorOf(record: LocalRecord, name: string, loinc: string): string {
  if (loinc) {
    const same = record.observations.find((row) => row.system === 'loinc' && row.code === loinc)
    if (same) return same.indicator
  }
  const named = record.observations.find((row) => row.name === name || row.indicator === name)
  return named ? named.indicator : name
}

export type FileResult = { saved: number; skipped: number; problems: string[]; indicators: string[] }

export function fileObservations(path: string, items: readonly Item[], defaults: { date: string; source: string; file: string }): FileResult {
  const record = readLocalRecord(path)
  const problems: string[] = []
  const touched = new Set<string>()
  let saved = 0
  let skipped = 0
  const today = isoDay()
  items.forEach((item, index) => {
    const name = text(item.name)
    const value = text(item.value, 60)
    const date = text(item.date) || defaults.date
    if (!name || !value) {
      problems.push(`第 ${index + 1} 项缺名字或数值`)
      return
    }
    if (!DATE.test(date) || date > today) {
      problems.push(`${name}：日期 ${date || '空'} 不对（要 YYYY-MM-DD，且不晚于今天）`)
      return
    }
    const loinc = text(item.loinc, 20).replace(/^loinc:/i, '')
    const indicator = indicatorOf(record, name, loinc)
    const unit = text(item.unit, 30)
    const time = text(item.time, 19) || `${date} 08:00:00`
    const duplicate = record.observations.some((row) => row.indicator === indicator && row.date === date && row.value === value && row.unit === unit)
    if (duplicate) {
      skipped += 1
      return
    }
    const row: Observation = {
      indicator,
      name,
      system: loinc ? 'loinc' : '',
      code: loinc,
      unit,
      date,
      time,
      value,
      file: defaults.file,
      source: defaults.source,
      ...(text(item.ref_low, 20) ? { ref_low: text(item.ref_low, 20) } : {}),
      ...(text(item.ref_high, 20) ? { ref_high: text(item.ref_high, 20) } : {}),
      ...(text(item.flag, 10) ? { flag: text(item.flag, 10) } : {}),
      added_at: new Date().toISOString(),
    }
    record.observations.push(row)
    touched.add(name)
    saved += 1
  })
  if (saved > 0) writeLocalRecord(path, record)
  return { saved, skipped, problems, indicators: [...touched] }
}

/** A CSV with a header: date,name,value,unit[,loinc][,ref_low][,ref_high]. Quoted fields allowed. */
export function parseCsv(raw: string): Item[] {
  const rows: string[][] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i] as string
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1 }
        else if (ch === '"') quoted = false
        else cur += ch
      } else if (ch === '"') quoted = true
      else if (ch === ',') { cells.push(cur); cur = '' }
      else cur += ch
    }
    cells.push(cur)
    rows.push(cells.map((cell) => cell.trim()))
  }
  const head = (rows.shift() ?? []).map((cell) => cell.toLowerCase())
  const at = (name: string) => head.indexOf(name)
  return rows.map((cells) => {
    const get = (name: string) => (at(name) >= 0 ? cells[at(name)] ?? '' : '')
    return { date: get('date'), name: get('name'), value: get('value'), unit: get('unit'), loinc: get('loinc'), ref_low: get('ref_low'), ref_high: get('ref_high'), time: get('time') }
  })
}

export function registerRecordTools(ctx: HostContext, dataDir: () => string, invalidate: () => void): void {
  const recordPath = () => join(resolveDataDir(dataDir()), RECORD_FILE)

  ctx.tools.register(defineTool({
    name: 'record_measurements',
    description: 'Save values from a checkup report, lab sheet, prescription-free test or device screen into the record on this computer, for the person LongPi is showing now. Read the report yourself first (PDF or photo), then pass every value exactly as printed: the name as printed (Chinese or English), the value as printed (keep flags like ↑ and qualitative results like 阴性), the unit as printed, and the lab\'s reference range when the sheet has one. Give the LOINC code only when you are sure. One call per report (date = the sampling or report date). Never estimate or convert a value. Returns how many were saved and what was skipped (already on file) or refused.',
    parameters: {
      date: { type: 'string', required: true, description: 'The report or sampling date, YYYY-MM-DD.' },
      source: { type: 'string', enum: [...SOURCES], description: 'checkup (a health checkup report), lab (a hospital lab sheet), device (a wearable or home device), self (the person measured it), import.' },
      file: { type: 'string', description: 'What it came from, as the person would say it (e.g. 2026 年度体检报告.pdf).' },
      items: {
        type: 'array',
        required: true,
        description: 'One row per printed value.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', required: true, description: 'The item name as printed, e.g. 低密度脂蛋白胆固醇 or LDL-C.' },
            value: { type: 'string', required: true, description: 'The value as printed, e.g. 3.85, 5.48 ↑, <0.5, 阴性.' },
            unit: { type: 'string', description: 'The unit as printed, e.g. mmol/L.' },
            loinc: { type: 'string', description: 'LOINC code, only when certain, e.g. 13457-7.' },
            ref_low: { type: 'string', description: 'Lower end of the printed reference range.' },
            ref_high: { type: 'string', description: 'Upper end of the printed reference range.' },
            flag: { type: 'string', description: 'H, L or the printed arrow, when the sheet flags it.' },
            date: { type: 'string', description: 'Only when this row has its own date (a series), YYYY-MM-DD.' },
          },
        },
      },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    execute(args: { date?: string; source?: string; file?: string; items?: Item[] }) {
      const date = text(args.date)
      if (!DATE.test(date)) return asJson({ ok: false, error: 'date must be YYYY-MM-DD' })
      const items = Array.isArray(args.items) ? args.items.slice(0, 400) : []
      if (items.length === 0) return asJson({ ok: false, error: 'no items' })
      const source = SOURCES.includes(args.source as (typeof SOURCES)[number]) ? String(args.source) : 'checkup'
      const out = fileObservations(recordPath(), items, { date, source, file: text(args.file, 120) || `${date} ${source === 'lab' ? '化验单' : '体检报告'}` })
      if (out.saved > 0) invalidate()
      return asJson({
        ok: out.problems.length === 0 || out.saved > 0,
        saved: out.saved,
        already_on_file: out.skipped,
        problems: out.problems,
        hint: out.saved > 0
          ? 'Read the saved values back in one short list. Then call read_personal_situation: the record changed (results, changes beyond normal fluctuation, the next step).'
          : 'Nothing new was saved. Say why from problems; do not change a value to make it fit.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'import_measurements_csv',
    description: 'Import many dated values at once (a wearable or app export, a spreadsheet of past checkups) from a CSV file on this computer. Header: date,name,value,unit and optionally loinc,ref_low,ref_high,time. Write that CSV yourself from the export first (a script is fine), keeping names, values and units as exported. Daily device series use names like dailySteps, restingHeartRate, hrvRmssd, sleepDuration so LongPi\'s experiments can use them.',
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute path of the CSV.' },
      source: { type: 'string', enum: [...SOURCES], description: 'device for a wearable export, import otherwise.' },
      file: { type: 'string', description: 'What it came from, as the person would say it.' },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    execute(args: { path?: string; source?: string; file?: string }) {
      const path = text(args.path, 500)
      if (!path.startsWith('/') || !existsSync(path)) return asJson({ ok: false, error: 'the CSV must be an absolute path on this computer that LongPi can read' })
      let raw = ''
      try {
        raw = readFileSync(path, 'utf8')
      } catch {
        return asJson({ ok: false, error: 'could not read the CSV' })
      }
      const items = parseCsv(raw).slice(0, 20000)
      const source = SOURCES.includes(args.source as (typeof SOURCES)[number]) ? String(args.source) : 'import'
      const out = fileObservations(recordPath(), items, { date: isoDay(), source, file: text(args.file, 120) || path.split('/').pop() || 'import.csv' })
      if (out.saved > 0) invalidate()
      return asJson({ ok: out.saved > 0, saved: out.saved, already_on_file: out.skipped, problems: out.problems.slice(0, 20), problem_count: out.problems.length })
    },
  }))
}
