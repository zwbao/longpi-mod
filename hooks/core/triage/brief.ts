// The one-page doctor brief (M1, PLAN §B1): why this visit, the multi-year trend of the values, medicines
// and conditions on file, questions to ask and tests to request. Deterministic (a template around the
// record's numbers); saved as dataDir/briefs/<id>.{json,md} to print or save. The name line is left blank
// to fill by hand, so the brief can go through the chat without the person's name (D10).

import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import type { NumberRef } from '../contracts/common.ts'
import type { DoctorBrief } from '../contracts/triage.ts'
import type { Config } from '../config.ts'
import { addDays } from '../interventions.ts'
import { loadSeries, type RecordSnapshot } from '../records.ts'
import type { IndicatorRow } from '../situation.ts'
import { currentMedications } from '../situation.ts'
import { memoryFor } from '../core/memory.ts'
import { newId, readJson, writeJsonAtomic } from '../core/store.ts'
import { currentBus } from '../core/bus.ts'
import type { CareState } from './care.ts'
import { patterns } from './rules.ts'
import { currentImport, doctorItems } from '../analysis/store.ts'
import { isLocalMcp, localRecordNow } from '../mcp.ts'
import { printedLevels } from '../local-record.ts'

/** Exam lines that say nothing is wrong. */
const NORMAL_LINE = /^(未见明显异常|未见异常|正常|阴性|无异常|窦性心律[，, ]*正常心电图|正常心电图)[。.]?$/
const EXAM_NAME = /彩超|B超|超声|CT|X线|DR|心电图|眼底|骨密度|胃镜|肠镜|核磁|MRI|钼靶|斑块|结节/

/**
 * What else the latest report shows a doctor should see with the reason for the visit: values outside the range the
 * report printed (not already in the trend table) and the imaging lines that are not normal. Local record only.
 */
function otherLines(trendLabels: readonly string[], config: Config): string[] {
  if (!isLocalMcp(config.mcpUrl)) return []
  const record = localRecordNow()
  if (!record) return []
  const labs = record.observations.filter((row) => row.source !== 'device')
  const latest = labs.map((row) => row.date).sort().at(-1)
  if (!latest) return []
  const levels = printedLevels(record)
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of labs.filter((item) => item.date === latest)) {
    const name = row.name || row.indicator
    if (!name || seen.has(name) || trendLabels.some((label) => label.includes(name) || name.includes(label))) continue
    const level = levels.get(`${name}|${latest}`)
    if (level) {
      seen.add(name)
      out.push(`${name} ${level.text_zh.replace(/^报告上 /, '')}`)
      continue
    }
    const value = String(row.value).trim()
    if (EXAM_NAME.test(name) && !/^[\d.<>]/.test(value) && !NORMAL_LINE.test(value)) {
      seen.add(name)
      out.push(`${name}：${value}`)
    }
  }
  return out.slice(0, 14)
}

/** 「9 月 10 日」, with the year when it is not this year. */
function dayZhT(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
}

const LOOKBACK_DAYS = 10 * 365
const MAX_COLUMNS = 6

interface MarkerSpec { key: string; label_zh: string; unit: string; test: (row: IndicatorRow) => boolean }

const text = (row: Pick<IndicatorRow, 'name' | 'label'>) => `${row.name} ${row.label ?? ''}`
const MARKERS: MarkerSpec[] = [
  { key: 'hb', label_zh: '血红蛋白', unit: 'g/L', test: (row) => row.loinc === '718-7' || (/血红蛋白|Hemoglobin-HGB|^HGB/i.test(text(row)) && !/糖化|平均|浓度|含量|尿|A1c/i.test(text(row))) },
  { key: 'mcv', label_zh: '平均红细胞体积', unit: 'fL', test: (row) => row.loinc === '787-2' || /平均红细胞体积|MCV/i.test(text(row)) },
  { key: 'mch', label_zh: '平均红细胞血红蛋白含量', unit: 'pg', test: (row) => row.loinc === '785-6' || (/平均红细胞血红蛋白含量|\bMCH\b(?!C)/i.test(text(row)) && !/浓度|MCHC/i.test(text(row))) },
  { key: 'mchc', label_zh: '平均红细胞血红蛋白浓度', unit: 'g/L', test: (row) => row.loinc === '786-4' || /平均红细胞血红蛋白浓度|MCHC/i.test(text(row)) },
  { key: 'rdw', label_zh: '红细胞分布宽度（CV）', unit: '%', test: (row) => (row.loinc === '788-0' || /红细胞分布宽度|RDW/i.test(text(row))) && !/标准差|SD|血小板|PDW/i.test(text(row)) && !/fl/i.test(row.unit) },
  { key: 'ferritin', label_zh: '铁蛋白', unit: 'ng/mL', test: (row) => row.loinc === '2276-4' || /铁蛋白|ferritin/i.test(text(row)) },
  { key: 'glucose', label_zh: '空腹血糖', unit: 'mmol/L', test: (row) => row.loinc === '14771-0' || /空腹血糖|空腹葡萄糖/.test(text(row)) },
  { key: 'hba1c', label_zh: '糖化血红蛋白', unit: '%', test: (row) => row.loinc === '4548-4' || /糖化血红蛋白|HbA1c/i.test(text(row)) },
  { key: 'ldl', label_zh: '低密度脂蛋白胆固醇', unit: 'mmol/L', test: (row) => row.loinc === '13457-7' || row.loinc === '2089-1' || /低密度脂蛋白/.test(text(row)) },
  { key: 'tc', label_zh: '总胆固醇', unit: 'mmol/L', test: (row) => row.loinc === '2093-3' || /总胆固醇/.test(text(row)) },
  { key: 'sbp', label_zh: '收缩压', unit: 'mmHg', test: (row) => row.loinc === '8480-6' || /收缩压/.test(text(row)) },
  { key: 'dbp', label_zh: '舒张压', unit: 'mmHg', test: (row) => row.loinc === '8462-4' || /舒张压/.test(text(row)) },
]

function fmt(value: number): string {
  return String(Number(value.toFixed(2)))
}

export interface BriefInput {
  config: Config
  dataDir: string
  records: RecordSnapshot
  today: string
  care: CareState
}

export interface BriefResult { brief: DoctorBrief; markdown: string }

/** The trend rows for the markers of the findings, read from Mirobody across checkups (one value per day). */
async function trendOf(input: BriefInput, keys: string[]): Promise<DoctorBrief['trend']> {
  const specs = MARKERS.filter((spec) => keys.includes(spec.key))
  const rows = input.records.indicators.filter((row) => row.source !== 'self')
  const namesBy = new Map<string, string[]>()
  for (const spec of specs) namesBy.set(spec.key, [...new Set(rows.filter(spec.test).map((row) => row.name))])
  const names = [...new Set([...namesBy.values()].flat())]
  let series: Record<string, { points: Array<{ date: string; value: number }> }> = {}
  if (names.length > 0) {
    try {
      const read = await loadSeries(input.config, names, { start: addDays(input.today, -LOOKBACK_DAYS), end: input.today, resolution: 'raw' })
      series = read.series
    } catch {
      series = {}
    }
  }
  const out: DoctorBrief['trend'] = []
  for (const spec of specs) {
    const byDay = new Map<string, number>()
    for (const name of namesBy.get(spec.key) ?? []) {
      for (const point of series[name]?.points ?? []) if (Number.isFinite(point.value)) byDay.set(point.date.slice(0, 10), point.value)
      // The latest value on the catalogue row, when the series read failed.
      const row = rows.find((item) => item.name === name)
      const value = row ? Number.parseFloat(row.value) : Number.NaN
      const day = (row?.date || row?.last_date || '').slice(0, 10)
      if (day && Number.isFinite(value) && !byDay.has(day)) byDay.set(day, value)
    }
    const points: NumberRef[] = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-MAX_COLUMNS)
      .map(([date, value]) => ({ key: `${spec.key}@${date}`, label_zh: spec.label_zh, value, unit: spec.unit, date, source: 'record', text: spec.unit === '%' ? `${fmt(value)}%` : `${fmt(value)} ${spec.unit}` }))
    if (points.length > 0) out.push({ label_zh: `${spec.label_zh}（${spec.unit}）`, points })
  }
  return out
}

function markdownOf(brief: DoctorBrief, person: { age: number | null; sex: string }, reasons: string[], seen: string[]): string {
  const sex = person.sex === 'male' ? '男' : person.sex === 'female' ? '女' : '未填'
  const lines: string[] = [
    `# 给医生的一页简报`,
    '',
    `姓名：__________　性别：${sex}　年龄：${person.age ?? '未填'}　整理日期：${brief.created}`,
    '',
    '> 由 LongPi 根据本人历次体检记录整理。数字来自体检报告，参考下限为常用值；这不是诊断，也不是用药建议。',
    '',
    '## 为什么来看医生',
    ...reasons.map((line) => `- ${line}`),
    ...(seen.length > 0 ? ['', ...seen.map((line) => `- ${line}`)] : []),
    '',
    '## 历次结果',
  ]
  const days = [...new Set(brief.trend.flatMap((row) => row.points.map((point) => point.date ?? '')))].filter(Boolean).sort().slice(-MAX_COLUMNS)
  if (brief.trend.length > 0 && days.length > 0) {
    lines.push(`| 指标 | ${days.join(' | ')} |`, `|---|${days.map(() => '---').join('|')}|`)
    for (const row of brief.trend) lines.push(`| ${row.label_zh} | ${days.map((day) => { const point = row.points.find((item) => item.date === day); return point ? fmt(point.value) : '—' }).join(' | ')} |`)
  } else {
    lines.push('（本次未读取到历次结果，请携带纸质或电子体检报告。）')
  }
  if (brief.others_zh?.length) {
    lines.push('', '## 报告上其他需要一起看的', '> 同一份报告里，超出报告参考范围的数值和不是「未见异常」的检查结论；请医生一起评估。', '', ...brief.others_zh.map((line) => `- ${line}`))
  }
  if (brief.analysis_zh?.length) {
    lines.push('', '## 深度分析建议由医生评估的事项', '> 来自多组学深度分析，是建议，不是诊断；是否需要、怎么做，请医生决定。', '', ...brief.analysis_zh.map((line) => `- ${line}`))
  }
  lines.push('', '## 目前在用的药和补剂', ...(brief.meds_zh.length > 0 ? brief.meds_zh.map((line) => `- ${line}`) : ['- 记录中无']))
  if (brief.conditions_zh.length > 0) lines.push('', '## 本人说过的情况', ...brief.conditions_zh.map((line) => `- ${line}`))
  lines.push('', '## 想问医生的问题', ...brief.questions_zh.map((line, index) => `${index + 1}. ${line}`))
  lines.push('', '## 可以请医生考虑的检查', ...brief.tests_zh.map((line) => `- ${line}`))
  lines.push('', '## 看完医生之后', '请将医生的结论告诉 LongPi（例如「医生说……，开了……，X 周后复查」），LongPi 会记录下来，并据此调整下一步和方案。', '')
  return lines.join('\n')
}

function briefDir(dataDir: string): string {
  return join(dataDir, 'briefs')
}

/** The current deep analysis's items for a doctor, one line each, and the day it was imported. */
function analysisLines(dataDir: string): { lines: string[]; day: string | null } {
  const cur = currentImport(dataDir)
  if (!cur) return { lines: [], day: null }
  const lines = doctorItems(cur.value).map((item) => `${item.title}${item.detail && item.detail !== item.title ? `：${item.detail}` : ''}`)
  return { lines, day: cur.meta.imported_at?.slice(0, 10) ?? null }
}

export async function buildBrief(input: BriefInput): Promise<BriefResult | null> {
  const findings = [...input.care.findings.filter((row) => row.status !== 'visited'), ...input.care.findings.filter((row) => row.status === 'visited')]
  const analysis = analysisLines(input.dataDir)
  if (findings.length === 0 && analysis.lines.length === 0) return null
  const keys = [...new Set(findings.flatMap((finding) => patterns().find((row) => `finding-${row.id}` === finding.id)?.trend_markers ?? []))]
  const trend = await trendOf(input, keys)
  const memory = memoryFor(input.dataDir)
  const memMeds = (memory.read().items.filter((item) => item.status === 'active' && (item.kind === 'medication' || item.kind === 'supplement')) as Array<{ name_zh: string; regimen_text?: string; stopped?: string | null }>)
    .filter((item) => !item.stopped).map((item) => `${item.name_zh}${item.regimen_text ? `（${item.regimen_text}）` : ''}`)
  const recordMeds = currentMedications(input.records.medications)
  const meds = [...new Set([...recordMeds, ...memMeds.filter((line) => !recordMeds.some((name) => line.startsWith(name)))])]
  const conditions = (memory.read().items.filter((item) => item.status === 'active' && (item.kind === 'condition' || item.kind === 'family_history')) as Array<{ text_zh: string }>).map((item) => item.text_zh)
  const others = otherLines(trend.map((row) => row.label_zh), input.config)
  const brief: DoctorBrief = {
    id: newId('brief'),
    ...(others.length > 0 ? { others_zh: others } : {}),
    finding_ids: findings.map((row) => row.id),
    created: input.today,
    trend,
    meds_zh: meds,
    conditions_zh: conditions,
    questions_zh: [...new Set([
      ...findings.flatMap((row) => row.questions_zh),
      ...(analysis.lines.length ? ['深度分析建议的这几项（见上）适合我吗？哪些需要先做检查？'] : []),
    ])],
    tests_zh: [...new Set(findings.flatMap((row) => row.tests_to_request_zh))],
    ...(analysis.lines.length ? { analysis_zh: analysis.lines } : {}),
    summary_zh: [...findings.map((row) => `${row.title_zh}（建议看${row.department_zh}）`), ...(analysis.lines.length ? [`深度分析建议由医生评估 ${analysis.lines.length} 项`] : [])].join('；'),
    source: 'template',
  }
  const reasons = [
    ...findings.map((row) => `${row.text_zh}。建议看${row.department_zh}。`),
    ...(analysis.lines.length ? [`深度分析${analysis.day ? `（${dayZhT(analysis.day)}导入）` : ''}建议有 ${analysis.lines.length} 项由医生评估，见下文。`] : []),
  ]
  const seen = input.care.seen.map(({ finding, care }) => `已看过医生${care.visit_date ? `（${dayZhT(care.visit_date)}）` : ''}：${finding.title_zh}${care.outcome_zh ? `，医生说：${care.outcome_zh}` : ''}`)
  const markdown = markdownOf(brief, { age: input.records.profile.age, sex: input.records.profile.sex }, reasons, seen)
  const dir = briefDir(input.dataDir)
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const file = join(dir, `${brief.id}.md`)
    writeFileSync(file, markdown, { mode: 0o600 })
    chmodSync(file, 0o600)
    brief.file = file
    writeJsonAtomic(join(dir, `${brief.id}.json`), brief)
  } catch {
    // the brief is still returned; only the file is missing
  }
  currentBus()?.emit('brief.generated', { brief_id: brief.id, finding_ids: brief.finding_ids, source: 'template' }, { module: 'M1', via: 'route' })
  return { brief, markdown }
}

/** A saved brief by id, or the newest when id is empty. */
export function readBrief(dataDir: string, id = ''): BriefResult | null {
  const dir = briefDir(dataDir)
  if (!existsSync(dir)) return null
  const ids = readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort()
  const pick = id ? ids.find((row) => row === id) : ids.at(-1)
  if (!pick || !/^[a-z0-9-]+$/.test(pick)) return null
  const brief = readJson<DoctorBrief | null>(join(dir, `${pick}.json`), (raw) => (raw && typeof raw === 'object' ? raw as DoctorBrief : null), () => null)
  if (!brief) return null
  let markdown = ''
  try {
    markdown = readFileSync(join(dir, `${pick}.md`), 'utf8')
  } catch {
    markdown = ''
  }
  return { brief, markdown }
}
