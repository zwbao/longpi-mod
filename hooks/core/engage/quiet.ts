// Quiet home (0.5.5). A season, a daily check-in, and the words 打卡 / 每天 / 每晚 / 提醒我
// stay off the first screen until the person opts in. A stated "别天天提醒我" or a
// low-engagement record turns that pressure back off.

import { existsSync, readFileSync, writeFileSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import type { NextBestAction, SurfaceCard, SurfaceSet } from '../contracts/surfaces.ts'
import { memoryFor } from '../core/memory.ts'
import { checkinStatus, currentPlan, readCheckIns } from '../interventions.ts'

export const DAILY_WORDING = /打卡|每天|每晚|提醒我/
export const QUIET_TITLE = '有空时查看'
export const QUIET_DETAIL = '不安排每日任务。需要开始时，请告诉 LongPi。'

const CADENCE_QUIET = new Set(['off', 'quiet', 'rare', 'monthly', 'low'])
const CADENCE_ON = new Set(['daily', 'season', 'on'])

export interface QuietSignals {
  optedIn: boolean
  avoidance: boolean
  /** Rare cadence, or almost no check-ins and no saved plan. */
  lowEngagement: boolean
}

export function statedAvoidance(text: string): boolean {
  const raw = String(text ?? '').normalize('NFKC')
  if (/别天天|不要天天|别每天|不要每天|别提醒我|不要提醒我|不用提醒|别布置作业|不要布置作业|别推送|不要推送|别打扰我|不要打扰我|不想被提醒|不需要每天|别催我/.test(raw)) return true
  return /一句话/.test(raw) && /(?:只要|只用|就用|用一句话|一句话告诉|一句话就)/.test(raw)
}

export function seasonPressureOn(signals: QuietSignals): boolean {
  return signals.optedIn && !signals.avoidance
}

/** Drop check-in wording from the home when they have not opted into the season and they are quiet. */
export function stripDailyWording(signals: QuietSignals): boolean {
  if (seasonPressureOn(signals)) return false
  return signals.avoidance || signals.lowEngagement
}

/** Do not send a reminder after they asked not to be nagged. A missing plan is not enough: follow-up tests send those. */
export function remindersHeld(signals: QuietSignals): boolean {
  return signals.avoidance
}

function pressureChoice(dataDir: string): 'on' | 'off' | null {
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'engage', 'state.json'), 'utf8')) as { pressure?: unknown }
    return raw.pressure === 'on' || raw.pressure === 'off' ? raw.pressure : null
  } catch {
    return null
  }
}

function followupEnabled(dataDir: string): boolean {
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'followup.json'), 'utf8')) as { enabled?: unknown }
    return raw.enabled === true
  } catch {
    return false
  }
}

function doneCheckinDays(dataDir: string): number {
  try {
    const days = new Set<string>()
    for (const byDay of checkinStatus(readCheckIns(dataDir)).values()) {
      for (const [day, done] of byDay) if (done) days.add(day)
    }
    return days.size
  } catch {
    return 0
  }
}

export function readQuiet(dataDir: string): QuietSignals {
  const blank: QuietSignals = { optedIn: false, avoidance: false, lowEngagement: true }
  if (!dataDir) return blank
  try {
    const choice = pressureChoice(dataDir)
    let memoryOn = false
    let avoidance = false
    let cadenceQuiet = false
    const items = memoryFor(dataDir).read().items
    for (const item of items) {
      if (item.status !== 'active') continue
      const text = `${item.text_zh} ${item.provenance?.quote_zh ?? ''}`
      if (statedAvoidance(text)) avoidance = true
      if (item.kind === 'exclusion' && item.scope === 'reminder') avoidance = true
      if (item.kind === 'preference' && item.key === 'cadence') {
        const value = String(item.value)
        if (CADENCE_ON.has(value)) memoryOn = true
        if (CADENCE_QUIET.has(value)) cadenceQuiet = true
      }
    }
    // An explicit "开始这一季" wins until they state the avoidance again (that writes pressure off).
    const explicitOn = choice === 'on'
    if (explicitOn) avoidance = false
    else if (cadenceQuiet) avoidance = true
    const optedIn = explicitOn || (memoryOn && !avoidance && choice !== 'off')
    const lowEngagement = cadenceQuiet || (!currentPlan(dataDir) && doneCheckinDays(dataDir) < 2 && !followupEnabled(dataDir))
    return { optedIn, avoidance, lowEngagement }
  } catch {
    return blank
  }
}

/** Remember "别天天提醒我" and turn season pressure off. */
export function rememberAvoidance(dataDir: string, text: string): boolean {
  if (!dataDir || !statedAvoidance(text)) return false
  const quote = text.normalize('NFKC').trim().slice(0, 200)
  try {
    memoryFor(dataDir).apply([{
      op: 'add',
      item: {
        kind: 'preference',
        key: 'cadence',
        value: 'off',
        text_zh: quote,
        confirmed: true,
        provenance: { kind: 'rule', at: new Date().toISOString(), by: 'M6', quote_zh: quote },
      },
    }], 'M6')
  } catch {
    return false
  }
  const path = join(dataDir, 'engage', 'state.json')
  if (!existsSync(path)) return true
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    raw.pressure = 'off'
    writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`)
  } catch {
    // the preference is already enough to keep the home quiet
  }
  return true
}

function isSeasonPressure(action: { id?: string; kind?: string; title_zh?: string; detail_zh?: string }): boolean {
  const blob = `${action.id ?? ''} ${action.kind ?? ''} ${action.title_zh ?? ''} ${action.detail_zh ?? ''}`
  return action.kind === 'codex_experiment' || action.id === 'nba-codex-pack' || action.id === 'nba-season-quest' || /不用每天打卡|这一季只做几件事|这个赛季只做几件事|本赛季只需完成几件事|我这一季现在该做什么|这个赛季我现在该做什么/.test(blob)
}

function scrubText(text: string, signals: QuietSignals): string {
  let out = text
  if (!seasonPressureOn(signals)) {
    out = out.replace(/(?:(?:这一季|这个赛季)只做几件事|本赛季只需完成几件事)[，,]?\s*不用每天打卡。?/g, '')
    out = out.replace(/不用每天打卡。?/g, '')
  }
  if (stripDailyWording(signals) && DAILY_WORDING.test(out)) return ''
  return out.trim()
}

function cleanCard(card: SurfaceCard, signals: QuietSignals): SurfaceCard {
  const text = scrubText(card.text_zh, signals)
  const detail = typeof card.detail_zh === 'string' ? scrubText(card.detail_zh, signals) : card.detail_zh
  const prompt = typeof card.prompt_zh === 'string' ? scrubText(card.prompt_zh, signals) : card.prompt_zh
  if (!text && DAILY_WORDING.test(card.text_zh)) {
    return { ...card, text_zh: QUIET_TITLE, ...(card.detail_zh != null ? { detail_zh: QUIET_DETAIL } : {}), ...(card.prompt_zh != null ? { prompt_zh: QUIET_TITLE } : {}) }
  }
  return {
    ...card,
    text_zh: text || card.text_zh,
    ...(detail !== undefined ? { detail_zh: detail } : {}),
    ...(prompt !== undefined ? { prompt_zh: prompt } : {}),
  }
}

function quietAction(title: string, detail: string): NextBestAction {
  return {
    id: 'quiet-next',
    kind: 'read_result',
    provider: 'M5',
    priority: 10,
    mandatory: false,
    reason_codes: ['quiet'],
    fact_ids: [],
    target: { surface: 'page' },
    title_zh: title,
    detail_zh: detail,
  }
}

/** Copy of the surface set with season pressure and, when they are quiet, daily wording removed. */
export function quietenSurfaces(set: SurfaceSet, stageNext: { title_zh: string; detail_zh: string }, signals: QuietSignals): SurfaceSet {
  const copy = JSON.parse(JSON.stringify(set)) as SurfaceSet
  const dropAction = (action: NextBestAction): boolean => {
    if (!seasonPressureOn(signals) && isSeasonPressure(action)) return true
    return stripDailyWording(signals) && DAILY_WORDING.test(`${action.title_zh}${action.detail_zh}`)
  }
  copy.more = copy.more.filter((action) => !dropAction(action)).map((action) => ({
    ...action,
    title_zh: scrubText(action.title_zh, signals) || action.title_zh,
    detail_zh: scrubText(action.detail_zh, signals) || action.detail_zh,
  }))
  copy.suggestions = copy.suggestions
    .filter((card) => seasonPressureOn(signals) || !isSeasonPressure({ id: card.action_id, title_zh: card.text_zh, detail_zh: card.prompt_zh }))
    .map((card) => cleanCard(card, signals))
    .filter((card) => !stripDailyWording(signals) || !DAILY_WORDING.test(`${card.text_zh}${card.prompt_zh ?? ''}`))
  copy.status = cleanCard(copy.status, signals)
  copy.greeting = cleanCard(copy.greeting, signals)
  if (copy.weekly) copy.weekly = cleanCard(copy.weekly, signals)
  if (copy.nudge) copy.nudge = cleanCard(copy.nudge, signals)
  const nextBad = dropAction(copy.next.action) || (stripDailyWording(signals) && DAILY_WORDING.test(`${copy.next.card.text_zh}${copy.next.card.detail_zh ?? ''}`))
  if (nextBad) {
    const stageClean = !stripDailyWording(signals) && !DAILY_WORDING.test(`${stageNext.title_zh}${stageNext.detail_zh}`) && !isSeasonPressure(stageNext)
    const title = stageClean ? stageNext.title_zh : QUIET_TITLE
    const detail = stageClean ? stageNext.detail_zh : QUIET_DETAIL
    const action = quietAction(title, detail)
    copy.next = {
      action,
      card: { ...copy.next.card, text_zh: title, detail_zh: detail, action_id: action.id, prompt_zh: undefined },
    }
  } else {
    copy.next = {
      action: {
        ...copy.next.action,
        title_zh: scrubText(copy.next.action.title_zh, signals) || copy.next.action.title_zh,
        detail_zh: scrubText(copy.next.action.detail_zh, signals) || copy.next.action.detail_zh,
      },
      card: cleanCard(copy.next.card, signals),
    }
  }
  return copy
}
