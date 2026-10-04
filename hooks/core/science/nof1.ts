// Personal N-of-1: design an ABAB or crossover on this person's own wearable series, and explain it here.
// Nothing in this file is sent to an aggregator.

import { createHash } from '../../sys/crypto.ts'
import { readFileSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import { writeJsonAtomic } from '../core/store.ts'
import { mean, pairedT, round } from './stats.ts'
import { nOf1SeasonQuest, posteriorDiff, readingsForAnalysis, stoppingRule, type NOf1Quest, type Posterior, type ScheduleBlock, type Stopping, type TrialReading } from './nof1-model.ts'

export type DesignKind = 'abab' | 'crossover'

export interface WearableDay { day: string; steps: number | null; resting_hr: number | null }

export interface NOf1Result {
  design: DesignKind
  title_zh: string
  protocol_zh: string
  schedule: ScheduleBlock[]
  result_zh: string
  numbers: Array<{ key: string; text: string }>
  claim: 'none' | 'describe'
  seed: string
  posterior: Posterior | null
  stopping: Stopping
  quest: NOf1Quest
  carryover_days: number
}

const BANNED = /证明|治愈|患有|确诊|年轻了|变年轻/

export function wordingProblem(text: string): string | null {
  const hit = BANNED.exec(text)
  return hit ? `不能写「${hit[0]}」` : null
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function firstArm(seed: string): 'morning' | 'after_dinner' {
  const hash = createHash('sha256').update(seed, 'utf8').digest()
  return (hash[0] ?? 0) % 2 === 0 ? 'morning' : 'after_dinner'
}

function schedule(kind: DesignKind, start: string, first: 'morning' | 'after_dinner'): ScheduleBlock[] {
  const other = first === 'morning' ? 'after_dinner' : 'morning'
  const order = kind === 'abab' ? [first, other, first, other] : [first, other, other, first]
  const blockDays = kind === 'abab' ? 7 : 14
  const washDays = kind === 'abab' ? 3 : 7
  const blocks: ScheduleBlock[] = []
  let cursor = start
  order.forEach((arm, index) => {
    const from = cursor
    const to = addDays(from, blockDays - 1)
    blocks.push({ arm, label_zh: arm === 'morning' ? '早晨走 20 分钟' : '晚饭后走 20 分钟', from, to, role: 'treatment' })
    cursor = addDays(to, 1)
    if (index < order.length - 1) {
      const washFrom = cursor
      const washTo = addDays(washFrom, washDays - 1)
      blocks.push({ arm: 'washout', label_zh: '洗脱期，不纳入比较', from: washFrom, to: washTo, role: 'washout' })
      cursor = addDays(washTo, 1)
    }
  })
  return blocks
}

interface Contrast { n: number; mean_a: number; mean_b: number; diff: number; t: number | null }

function contrast(a: number[], b: number[]): Contrast | null {
  if (a.length < 2 || b.length < 2) return null
  const meanA = mean(a)
  const meanB = mean(b)
  if (meanA == null || meanB == null) return null
  const paired = pairedT(a, b)
  return { n: Math.min(a.length, b.length), mean_a: meanA, mean_b: meanB, diff: meanB - meanA, t: paired && Number.isFinite(paired[0]) ? paired[0] : null }
}

function explainContrast(labelA: string, labelB: string, row: Contrast, unit: string): string {
  const t = row.t == null ? '' : `配对 t 大约 ${round(row.t)}。`
  const enough = row.n >= 4
  const head = `${labelA}平均 ${round(row.mean_a)} ${unit}，${labelB}平均 ${round(row.mean_b)} ${unit}，相差 ${round(row.diff)} ${unit}（${labelB}减${labelA}）。${t}`
  return enough
    ? `${head}这是你自己这 ${row.n} 对记录里的差别，只留在这台电脑上，不能当成治疗结论。`
    : `${head}目前仅有 ${row.n} 对记录，数量较少，暂不下结论，请按协议继续记录。`
}

/** Descriptive split of the watch series: high-step days versus low-step days. Not a randomised trial. */
export function wearableContrast(days: readonly WearableDay[]): { low: number[]; high: number[] } | null {
  const usable = days.filter((row) => row.steps != null && row.resting_hr != null)
  if (usable.length < 8) return null
  const ordered = [...usable].sort((a, b) => (a.steps ?? 0) - (b.steps ?? 0))
  const half = Math.floor(ordered.length / 2)
  const low = ordered.slice(0, half).map((row) => row.resting_hr ?? 0)
  const high = ordered.slice(ordered.length - half).map((row) => row.resting_hr ?? 0)
  return { low, high }
}

export function designNOf1(opts: {
  today: string
  design?: DesignKind
  question_zh?: string
  wearable?: readonly WearableDay[]
  /** Arm-labelled glucose the person already logged. */
  glucose?: { morning: number[]; after_dinner: number[] }
  /** Day-labelled readings. Washout and the carryover window are left out of the posterior. */
  readings?: readonly TrialReading[]
  seed?: string
  season_id?: string
  carryover_days?: number
  mcid?: number
}): NOf1Result {
  const design: DesignKind = opts.design ?? (opts.question_zh && /交叉|对调/.test(opts.question_zh) ? 'crossover' : 'abab')
  const seed = opts.seed ?? `nof1|${design}|${opts.today}`
  const first = firstArm(seed)
  const blocks = schedule(design, opts.today, first)
  const carryover = opts.carryover_days ?? 2
  const mcid = opts.mcid ?? 0.3
  const protocol = design === 'abab'
    ? `ABAB：本机用种子随机决定先走哪一种，每种走 7 天，中间 3 天洗脱，再重复。每次 20 分钟。每段开头 ${carryover} 天和洗脱不进入比较。比的是你自己的血糖，种子不出这台电脑。`
    : `交叉：本机用种子随机决定先走哪一种，每种连续两周，中间 7 天洗脱，然后按 ABBA 对调。每次 20 分钟。每段开头 ${carryover} 天和洗脱不进入比较。比的是你自己记下的血糖。`
  const numbers: NOf1Result['numbers'] = []
  let morning: number[] = []
  let after: number[] = []
  let excluded = 0
  if (opts.readings && opts.readings.length > 0) {
    const picked = readingsForAnalysis(blocks, opts.readings, carryover)
    morning = picked.morning
    after = picked.after_dinner
    excluded = picked.excluded
  } else if (opts.glucose) {
    morning = opts.glucose.morning
    after = opts.glucose.after_dinner
  }
  const posterior = morning.length >= 2 && after.length >= 2 ? posteriorDiff(morning, after) : null
  const periods = blocks.filter((row) => row.role === 'treatment').length
  const stopping = stoppingRule(posterior, { mcid, periods_done: opts.readings && opts.readings.length > 0 ? periods : 0, max_periods: periods, min_n: 4 })
  let result = '手表的每日步数没有区分早晨和晚饭后，所以现有记录还不能比较这两种走法。请从今天起按上述安排步行，并记录血糖（保存在这台电脑上）。'
  if (posterior) {
    const row = contrast(morning, after)
    if (row) {
      const interval = `后验均值 ${round(posterior.mean)}，95% 区间 ${round(posterior.ci95[0])} 到 ${round(posterior.ci95[1])}。`
      const dropped = excluded > 0 ? `洗脱和携带窗里有 ${excluded} 个读数没有进入比较。` : ''
      result = `${explainContrast('早晨走', '晚饭后走', row, 'mmol/L')}${interval}${dropped}${stopping.reason_zh}`
      numbers.push(
        { key: 'morning.mean', text: round(row.mean_a) },
        { key: 'after_dinner.mean', text: round(row.mean_b) },
        { key: 'diff', text: round(row.diff) },
        { key: 'posterior.mean', text: round(posterior.mean) },
      )
    }
  } else if (!opts.readings?.length) {
    const split = wearableContrast(opts.wearable ?? [])
    if (split) {
      const row = contrast(split.low, split.high)
      if (row) {
        result = `现有手表记录不能区分早晨和晚饭后。作为本机的描述（不是随机对照）：步数较低的日子静息心率平均 ${round(row.mean_a)} 次/分，步数较高的日子平均 ${round(row.mean_b)} 次/分，相差 ${round(row.diff)}。${row.n < 4 ? '天数较少。' : ''}这不能说明走路方式改变了血糖。`
        numbers.push({ key: 'hr.low_steps', text: round(row.mean_a) }, { key: 'hr.high_steps', text: round(row.mean_b) })
      }
    }
  } else {
    result = `已按随机顺序完成排期。洗脱期和每段开头 ${carryover} 天不纳入比较。目前有效记录不足，请继续在这台电脑上记录。`
  }
  const built: NOf1Result = {
    design,
    title_zh: design === 'abab' ? '个人 ABAB：早晨走和晚饭后走' : '个人交叉：早晨走和晚饭后走',
    protocol_zh: protocol,
    schedule: blocks,
    result_zh: result,
    numbers,
    claim: 'describe',
    seed,
    posterior,
    stopping,
    quest: nOf1SeasonQuest(opts.season_id ?? 'season-local'),
    carryover_days: carryover,
  }
  const problem = wordingProblem(`${built.protocol_zh} ${built.result_zh} ${built.stopping.reason_zh}`)
  if (problem) built.result_zh = '本次对照仅保存在本机，记录尚不足以比较。'
  return built
}

export type { TrialReading }

const FINISHED = new Set(['stop_difference', 'stop_futility', 'stop_cap'])

export function seasonIdOnDisk(dataDir: string): string {
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'engage', 'state.json'), 'utf8')) as { season?: { id?: string } }
    if (typeof raw.season?.id === 'string' && raw.season.id) return raw.season.id
  } catch { /* the season file belongs to M6 */ }
  return 'season-local'
}

/** The plan and the seed stay on this computer. The seed file is not part of the tool response. */
export function storeNOf1(dataDir: string, designed: NOf1Result): { completed: boolean } {
  writeJsonAtomic(join(dataDir, 'science', 'n-of-1.json'), {
    design: designed.design,
    protocol_zh: designed.protocol_zh,
    schedule: designed.schedule,
    quest: designed.quest,
    stopping: designed.stopping,
    seed_kept_local: true,
  })
  writeJsonAtomic(join(dataDir, 'science', 'n-of-1-seed.json'), { seed: designed.seed })
  return { completed: FINISHED.has(designed.stopping.decision) }
}

/** The model and the page see the plan. The random seed stays in the local file. */
export function publicNOf1(result: NOf1Result): Omit<NOf1Result, 'seed'> {
  const { seed: _seed, ...shown } = result
  return shown
}
