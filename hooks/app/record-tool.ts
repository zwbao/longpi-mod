// How a record grows in Claude Code: Claude reads a checkup PDF or photo itself and files each value here, as
// printed, into the record on this computer (core/local-record.ts), which every LongPi method then reads.
// Wearable and app exports come in as a CSV. Registered beside the core's own tools.

import { existsSync, readFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import type { HostContext } from '../sys/cordis.ts'
import { defineTool } from '../sys/dsh-tools.ts'
import { host } from '../sys/host.ts'
import { asJson } from '../core/json.ts'
import { readLocalRecord, RECORD_FILE, writeLocalRecord, type LocalRecord, type Observation } from '../core/local-record.ts'
import { resolveDataDir } from '../core/paths.ts'
import { isoDay } from '../core/interventions.ts'
import { extractGeneticsText, GENETICS_CAVEATS, RAW_EXPORT_ZH, storeGenetics } from '../core/datain/genetics.ts'
import { storeFindings } from '../core/datain/narrative.ts'
import { newId } from '../core/core/store.ts'
import { notFiled, reportItems } from './coverage.ts'

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

/** Reports already checked, and how many times: the check asks at most twice per report and date. */
const checked = new Map<string, number>()

/**
 * What the report shows that is not on file for this date yet: its pages read with macOS PDFKit, matched by name.
 * Null when there is no PDF path, the PDF has no text layer, or it was already checked twice.
 */
async function missingFromReport(report: string, date: string, recordFile: string): Promise<{ list: string[]; hint: string } | null> {
  if (!report.startsWith('/') || !report.toLowerCase().endsWith('.pdf')) return null
  const key = `${report}|${date}`
  const round = (checked.get(key) ?? 0) + 1
  if (round > 2) return null
  checked.set(key, round)
  const h = host()
  const run = await h.io.run(['osascript', '-l', 'JavaScript', join(h.pluginRoot, 'tools', 'pdf_text.js'), report, '80'], { timeoutMs: 60000 }).catch(() => null)
  if (!run || run.exitCode !== 0) return null
  let pages: string[] = []
  try {
    pages = (JSON.parse(run.stdout) as { text?: string[] }).text ?? []
  } catch {
    return null
  }
  const body = pages.join('\n')
  if (body.replace(/\s+/g, '').length < 200) return null
  const filed = readLocalRecord(recordFile).observations.filter((row) => row.date === date).map((row) => row.name || row.indicator)
  const gap = notFiled(reportItems(body), filed)
  const list = [...gap.exams.map((name) => `${name}（检查结论）`), ...gap.labs].slice(0, 40)
  if (list.length === 0) return { list: [], hint: 'Every exam section and lab row LongPi found on the report is on file.' }
  return {
    list,
    hint: round < 2
      ? 'These appear on the report but are not on file for this date. Read those parts again and file them with record_measurements (same date, same report), exactly as printed; skip any that are only a heading, a phone line, or a piece of a longer name broken across lines (then file the whole item). Never invent a value.'
      : 'Still not on file after a second look. If they are on the report, file them; otherwise say which parts could not be read.',
  }
}

export function registerRecordTools(ctx: HostContext, dataDir: () => string, invalidate: () => void, python: () => string = () => 'python3'): void {
  const recordPath = () => join(resolveDataDir(dataDir()), RECORD_FILE)

  ctx.tools.register(defineTool({
    name: 'record_measurements',
    description: 'Save values from a checkup report, lab sheet, prescription-free test or device screen into the record on this computer, for the person LongPi is showing now. Read the report yourself first (PDF or photo), then pass every value exactly as printed: the name as printed (Chinese or English), the value as printed (keep flags like ↑ and qualitative results like 阴性), the unit as printed, and the lab\'s reference range when the sheet has one. Give the LOINC code only when you are sure. One call per report (date = the sampling or report date). Never estimate or convert a value. Returns how many were saved and what was skipped (already on file) or refused.',
    parameters: {
      date: { type: 'string', required: true, description: 'The report or sampling date, YYYY-MM-DD.' },
      source: { type: 'string', enum: [...SOURCES], description: 'checkup (a health checkup report), lab (a hospital lab sheet), device (a wearable or home device), self (the person measured it), import.' },
      file: { type: 'string', description: 'What it came from, as the person would say it (e.g. 2026 年度体检报告.pdf).' },
      report: { type: 'string', description: 'The absolute path of the report file (a PDF) when you read one from disk. LongPi then checks its pages for anything not yet filed and lists it back to you.' },
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
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args: { date?: string; source?: string; file?: string; report?: string; items?: Item[] }) {
      const date = text(args.date)
      if (!DATE.test(date)) return asJson({ ok: false, error: 'date must be YYYY-MM-DD' })
      const items = Array.isArray(args.items) ? args.items.slice(0, 400) : []
      if (items.length === 0) return asJson({ ok: false, error: 'no items' })
      const source = SOURCES.includes(args.source as (typeof SOURCES)[number]) ? String(args.source) : 'checkup'
      const out = fileObservations(recordPath(), items, { date, source, file: text(args.file, 120) || `${date} ${source === 'lab' ? '化验单' : '体检报告'}` })
      if (out.saved > 0) invalidate()
      const missing = await missingFromReport(text(args.report, 500), date, recordPath())
      return asJson({
        ...(missing ? { not_filed: missing.list, not_filed_hint: missing.hint } : {}),
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

  ctx.tools.register(defineTool({
    name: 'import_apple_health',
    description: 'Import an Apple Health export (the export.zip from iPhone 健康 → 头像 → 导出所有健康数据, or the unzipped folder or export.xml) into the record as daily wearable values: steps, resting heart rate, heart rate variability, hours asleep, lowest blood oxygen, active energy, VO2 max, weight and blood pressure. Runs on this computer; nothing is uploaded. Large exports take a minute.',
    parameters: {
      export: { type: 'string', required: true, description: 'Absolute path of export.zip, export.xml or the apple_health_export folder.' },
      days: { type: 'number', description: 'How many days back to import (default 365).' },
    },
    output: jsonOut,
    timeoutMs: 600000,
    isConcurrencySafe: () => false,
    async execute(args: { export?: string; days?: number }) {
      const from = text(args.export, 500)
      if (!from.startsWith('/')) return asJson({ ok: false, error: 'give the absolute path of the Apple Health export (export.zip, export.xml or the folder)' })
      const days = Math.max(7, Math.min(3650, Math.round(Number(args.days) || 365)))
      const h = host()
      const out = join(resolveDataDir(dataDir()), 'imports', `apple-health-${isoDay()}.csv`)
      await h.io.run(['mkdir', '-p', join(resolveDataDir(dataDir()), 'imports')]).catch(() => undefined)
      const run = await h.io.run([python() || 'python3', join(h.pluginRoot, 'tools', 'apple_health.py'), from, '--days', String(days), '--out', out], { timeoutMs: 600000 })
        .catch((error: unknown) => ({ exitCode: -1, stdout: '', stderr: error instanceof Error ? error.message : String(error) }))
      if (run.exitCode !== 0) return asJson({ ok: false, error: run.stderr.trim().split('\n').slice(-2).join(' ') || 'the export could not be read' })
      let raw = ''
      try {
        raw = await h.io.read(out)
      } catch {
        return asJson({ ok: false, error: 'the converted values could not be read back' })
      }
      const items = parseCsv(raw).slice(0, 40000)
      const saved = fileObservations(recordPath(), items, { date: isoDay(), source: 'device', file: 'Apple 健康导出' })
      // Filed: the converted copy is only residue (a second plain copy of the person's data).
      await h.io.run(['rm', '-f', out]).catch(() => undefined)
      if (saved.saved > 0) invalidate()
      return asJson({
        ok: saved.saved > 0 || saved.skipped > 0,
        saved: saved.saved,
        already_on_file: saved.skipped,
        summary: run.stderr.trim(),
        problems: saved.problems.slice(0, 10),
        hint: saved.saved > 0 ? 'Say in one line what came in (which kinds of values, from when to when). The Codex experiments and 睡眠/运动 pages can use them now.' : 'Nothing new: the values were already on file, or the export had none of the kinds LongPi reads.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'import_genetic_report',
    description: 'Keep the key variants of a consumer genetic-test report (a WeGene-style narrative PDF, often thousands of pages) on this computer: APOE, folate (MTHFR), alcohol (ALDH2, ADH1B), lactose, caffeine, gout and the drug-response markers (statins, warfarin, clopidogrel, aspirin, metformin), plus the haplogroups. Only the matching sections are opened; the report is not uploaded or read in full. Use this instead of reading the whole PDF yourself. Returns what was kept and the caveats to say with it.',
    parameters: {
      report: { type: 'string', required: true, description: 'Absolute path of the genetic report PDF.' },
    },
    output: jsonOut,
    timeoutMs: 300000,
    isConcurrencySafe: () => false,
    async execute(args: { report?: string }) {
      const from = text(args.report, 500)
      if (!from.startsWith('/') || !from.toLowerCase().endsWith('.pdf')) return asJson({ ok: false, error: 'give the absolute path of the genetic report PDF' })
      const h = host()
      const keywords = ['祖源成分', '父系单倍群', '母系单倍群', '叶酸', '酒精代谢', '乳糖', '阿尔茨海默', '载脂蛋白', 'APOE', '氯吡格雷', '华法林', '阿托伐他汀', '瑞舒伐他汀', '阿司匹林', '二甲双胍', '痛风', '咖啡因']
      const run = await h.io.run(['osascript', '-l', 'JavaScript', join(h.pluginRoot, 'tools', 'genetics_pdf.js'), from, JSON.stringify(keywords)], { timeoutMs: 300000 })
        .catch((error: unknown) => ({ exitCode: -1, stdout: '', stderr: error instanceof Error ? error.message : String(error) }))
      let parsed: { cover?: string; sections?: Array<{ title: string; text: string }>; pages_read?: number; pages?: number; error?: string } = {}
      try {
        parsed = JSON.parse(run.stdout || '{}') as typeof parsed
      } catch {
        parsed = { error: 'unreadable' }
      }
      if (run.exitCode !== 0 || parsed.error) return asJson({ ok: false, error: 'this PDF could not be opened on this computer (macOS PDFKit). Ask them for the raw-data export (a .txt) from the genetic-test app instead.', raw_export_zh: RAW_EXPORT_ZH })
      // The cover line "<name> 基因检测报告" is dropped: no name is kept (the sample id stays local).
      const textAll = `${parsed.cover ?? ''}\n${(parsed.sections ?? []).map((row) => `${row.title}\n${row.text}`).join('\n')}`
        .split('\n').filter((line) => !/基因检测报告/.test(line)).join('\n')
      const summary = extractGeneticsText(textAll, 'pdf')
      summary.pages_read = parsed.pages_read ?? 0
      if (summary.variants.length === 0 && summary.headlines_zh.length === 0) summary.headlines_zh = ['叙述版报告的目录里没有找到关键位点。需要按位点保存时，请用原始数据导出文件。']
      const dir = resolveDataDir(dataDir())
      const stored = storeGenetics(dir, summary)
      storeFindings(dir, [{ id: newId('find'), date: stored.generated || isoDay(), kind: 'genetics', text_zh: stored.headlines_zh[0] || `基因报告：保存了 ${stored.variants.length} 个关键位点。` }])
      invalidate()
      return asJson({
        ok: true,
        pages_in_report: parsed.pages ?? null,
        pages_read: stored.pages_read,
        generated: stored.generated,
        headlines: stored.headlines_zh,
        variants: stored.variants.map((row) => ({ rsid: row.rsid, genotype: row.genotype, about: row.note_zh })),
        caveats: GENETICS_CAVEATS,
        how_to_say: 'Say in a few lines what was kept (the APOE call if there is one, the drug-response and nutrition markers), that only the matching sections were read, and the first caveat. Never turn a variant into a diagnosis, a cause of their lab results, a supplement or a dose; drug markers are for their doctor.',
      })
    },
  }))
}
