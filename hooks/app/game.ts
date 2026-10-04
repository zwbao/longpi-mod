// 通往 120 岁: the game layer over what the person actually does. Pi, the companion, grows through five forms
// with the running total of real actions that leave something in the record (a report entered, a measurement,
// a research card read, an experiment started or revealed, a visit with a brief, a retest, a method or deep
// analysis run, a family member added). The road has twelve stations, each an action, never an outcome.
//
// What it never does (the owner's Codex decisions, 2026-10-04): no reward for a check-in (打卡不验证等于奖励
// 撒谎), nothing tied to a biomarker value or its direction, no draws, rarities, streaks, daily chests or caps,
// no feature behind a station. Totals only go up: each deed keeps its highest count in <LongPi home>/game.json,
// so a deleted file or a re-import never shrinks Pi. Only the holder's own record counts; the demo person is
// shown as a demo and never saved, and a family member's record leaves the holder's game as it was.

import { existsSync, readFileSync, writeFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import type { HostContext } from '../sys/cordis.ts'
import type { ServerResponse } from '../sys/http.ts'

export const DEEDS = ['profile', 'reports', 'measures', 'cards', 'species', 'experiments', 'reveals', 'visits', 'retests', 'methods', 'analyses', 'plans', 'family', 'seasons'] as const
export type Deed = (typeof DEEDS)[number]
export type Deeds = Record<Deed, number>

export const DEED_ZH: Record<Deed, string> = {
  profile: '填好基本情况', reports: '体检报告', measures: '自测记录', cards: '读过的研究卡', species: '遇见的物种',
  experiments: '开始的小实验', reveals: '揭晓的实验', visits: '带简报看医生', retests: '复查', methods: '算过的方法',
  analyses: '深度分析', plans: '方案', family: '一起管理的家人', seasons: '走完的赛季',
}

export const FORMS = [
  { no: 0, zh: '一颗蛋', at: 0, line_zh: '蛋里有动静。做一件真事，它就会醒。' },
  { no: 1, zh: '小 Pi', at: 3, line_zh: '小 Pi 醒了，跟着你一起记。' },
  { no: 2, zh: '发芽的 Pi', at: 15, line_zh: '头上长出了芽：你的档案开始有样子了。' },
  { no: 3, zh: '出门走走的 Pi', at: 50, line_zh: '围上了围巾，准备走远路。' },
  { no: 4, zh: '百岁的 Pi', at: 150, line_zh: '白眉毛，金光环：一路走过来的。' },
] as const

type Ctx = { journey: J; codex: Cx; library: Lib; people: P; analysis: An; self: Sf; today: string }
type J = {
  today?: string
  profile?: { complete?: boolean; questions?: Array<{ key: string; label_zh: string; answered: boolean }> }
  records?: { indicator_count?: number; summary?: { checkups?: number; first_date?: string | null; last_date?: string | null; wearable_days?: number } }
  results?: { bioage?: { status?: string } }
  method_results?: unknown[]
  plan?: { exists?: boolean; version?: number; checkin_items?: Array<{ id: string; title: string; done_today: boolean | null }> }
  self?: { latest?: Array<{ key: string; date?: string; day?: string }> }
}
type Run = { id: string; experiment_id: string; title_zh: string; do_zh?: string; status: string; done_today?: boolean }
type Cx = {
  enabled?: boolean
  started?: boolean
  member?: unknown
  deck?: Run[]
  running?: Run[]
  ready?: Run[]
  packs?: Array<{ id: string; opened: string | null; source_zh?: string }>
  footprints?: Array<{ kind: string; day: string }>
  season?: { status?: string } | null
}
type Lib = { studies?: Array<{ id: string; chapter: string; title_zh: string; read: boolean }>; species?: Array<{ met: boolean }>; chapters?: Array<{ id: string; title_zh: string; size?: number }> }
type P = { active?: string; people?: Array<{ id: string; demo?: boolean }> }
type An = { runs?: unknown[]; current?: unknown }
type Sf = { rows?: Array<{ date?: string; day?: string; at?: string }> }

/** What the record says right now, each deed counted from durable state (never the event log). */
export function countDeeds(c: Ctx): Deeds {
  const footprints = c.codex.footprints ?? []
  const kind = (k: string) => footprints.filter((row) => row.kind === k).length
  const deck = c.codex.deck ?? []
  const started = deck.length + (c.codex.running?.length ?? 0) + (c.codex.ready?.length ?? 0)
  return {
    profile: c.journey.profile?.complete ? 1 : 0,
    reports: c.journey.records?.summary?.checkups ?? 0,
    measures: c.self.rows?.length ?? 0,
    cards: (c.library.studies ?? []).filter((row) => row.read).length,
    species: (c.library.species ?? []).filter((row) => row.met).length,
    experiments: started,
    reveals: deck.filter((row) => row.status === 'revealed').length,
    visits: kind('care_brief') + kind('family'),
    retests: kind('retest'),
    methods: c.journey.method_results?.length ?? 0,
    analyses: (c.analysis.runs?.length ?? 0) + (c.analysis.current ? 1 : 0),
    plans: c.journey.plan?.exists ? Math.max(1, c.journey.plan.version ?? 1) : 0,
    family: (c.people.people ?? []).filter((row) => row.id !== 'self' && !row.demo).length,
    seasons: kind('season'),
  }
}

/** Counted toward Pi's growth: what the person did. Method results LongPi computes by itself when a report
 * arrives are shown, but they are not the person's doing. */
const GROWS: readonly Deed[] = DEEDS.filter((key) => key !== 'methods')

export function total(deeds: Deeds): number {
  return GROWS.reduce((sum, key) => sum + (deeds[key] ?? 0), 0)
}

export function formOf(points: number): (typeof FORMS)[number] {
  let form: (typeof FORMS)[number] = FORMS[0]
  for (const row of FORMS) if (points >= row.at) form = row
  return form
}

/** The road. Each station is a thing done, phrased as a footprint; the first four are within reach in week one. */
export const STATIONS: ReadonlyArray<{ id: string; title_zh: string; how_zh: string; reached: (d: Deeds, c: Ctx) => boolean }> = [
  { id: 'start', title_zh: '填好了基本情况', how_zh: '在「档案」填好年龄、性别和几项病史。', reached: (d) => d.profile > 0 },
  { id: 'report', title_zh: '第一份报告进了档案', how_zh: '把一份体检报告交给 Pi（拖进对话，或者说「帮我录入」）。', reached: (d) => d.reports > 0 },
  { id: 'bioage', title_zh: '算出了身体年龄', how_zh: '报告里有九项常规血检时，Pi 会自动算。', reached: (_d, c) => c.journey.results?.bioage?.status === 'ok' },
  { id: 'cards5', title_zh: '读了 5 张研究卡', how_zh: '在「长寿图鉴」的图书馆里读研究卡。', reached: (d) => d.cards >= 5 },
  { id: 'plan', title_zh: '定下了一个方案', how_zh: '让 Pi 按你的结果起草一个方案，你点「采纳」。', reached: (d) => d.plans > 0 },
  { id: 'measure', title_zh: '在家量过一次', how_zh: '量一次腰围、体重或血压，告诉 Pi。', reached: (d) => d.measures > 0 },
  { id: 'experiment', title_zh: '开始了第一个小实验', how_zh: '在「长寿图鉴」拆开实验包，选一个两周的小实验。', reached: (d) => d.experiments > 0 },
  { id: 'reveal', title_zh: '揭晓了一个实验', how_zh: '实验做满两周，翻开结果卡。', reached: (d) => d.reveals > 0 },
  { id: 'doctor', title_zh: '带着简报见了医生', how_zh: '需要看医生时，带上 Pi 整理的简报，回来告诉 Pi。', reached: (d) => d.visits > 0 },
  { id: 'retest', title_zh: '按时复查了', how_zh: '到了复查的时候去复查，把新报告交给 Pi。', reached: (d) => d.retests > 0 || d.reports >= 2 },
  { id: 'season', title_zh: '走完了一个赛季', how_zh: '一个赛季八周，做完几个小实验就算走完。', reached: (d) => d.seasons > 0 },
  { id: 'year', title_zh: '一年后又体检了一次', how_zh: '隔一年再做一次全面体检，看看这一年。', reached: (_d, c) => yearApart(c.journey.records?.summary) },
]

function yearApart(summary: { checkups?: number; first_date?: string | null; last_date?: string | null } | undefined): boolean {
  if (!summary?.first_date || !summary.last_date || (summary.checkups ?? 0) < 2) return false
  return (Date.parse(summary.last_date) - Date.parse(summary.first_date)) / 86_400_000 >= 330
}

/** Collections on the medal wall: counts of real things, each a medal once. */
export const MEDALS: ReadonlyArray<{ id: string; title_zh: string; how_zh: string; earned: (d: Deeds, c: Ctx) => boolean }> = [
  { id: 'reader', title_zh: '读完一章', how_zh: '读完图书馆里任意一章的研究卡。', earned: (_d, c) => chapterDone(c) },
  { id: 'species', title_zh: '九种动物都遇见了', how_zh: '研究卡里会遇见小鼠、线虫、裸鼹鼠……', earned: (d) => d.species >= 9 },
  { id: 'measures', title_zh: '十次自测', how_zh: '在家量过十次。', earned: (d) => d.measures >= 10 },
  { id: 'reports', title_zh: '三份报告', how_zh: '档案里有三次体检。', earned: (d) => d.reports >= 3 },
  { id: 'experiments', title_zh: '三个小实验', how_zh: '揭晓过三个小实验。', earned: (d) => d.reveals >= 3 },
  { id: 'family', title_zh: '一家人一起', how_zh: '把一位家人也加进来。', earned: (d) => d.family > 0 },
  { id: 'library', title_zh: '读过 30 张研究卡', how_zh: '在长寿图鉴的图书馆里读满 30 张。', earned: (d) => d.cards >= 30 },
  { id: 'analysis', title_zh: '一次深度分析', how_zh: '让 Pi 对整个档案做一次深度分析。', earned: (d) => d.analyses > 0 },
]

function chapterDone(c: Ctx): boolean {
  const studies = c.library.studies ?? []
  return (c.library.chapters ?? []).some((chapter) => {
    const rows = studies.filter((row) => row.chapter === chapter.id)
    return rows.length > 0 && rows.every((row) => row.read)
  })
}

export type GameAction = { kind: 'go'; tab: string; sub?: Record<string, string> } | { kind: 'say'; text: string } | { kind: 'fill'; text: string }
export type Thing = { id: string; text_zh: string; action: GameAction; done: boolean }

/** Today's candidates, in priority order; the first three are picked once a day and kept, done or not. */
function candidates(c: Ctx, deeds: Deeds): Array<Thing & { open: boolean }> {
  const out: Array<Thing & { open: boolean }> = []
  const add = (id: string, text: string, action: GameAction, open: boolean, done = false) => out.push({ id, text_zh: text, action, open, done })
  const codexTab = (tab: string): GameAction => ({ kind: 'go', tab: 'codex', sub: { 'codex.tab': tab } })
  const ready = c.codex.ready?.[0]
  if (ready) add(`reveal:${ready.id}`, `翻开「${ready.title_zh}」的结果`, codexTab('exp'), true)
  const pack = (c.codex.packs ?? []).find((row) => !row.opened)
  if (pack) add(`pack:${pack.id}`, '拆开一个新的实验包', codexTab('exp'), true)
  const unreadNew = (c.library.studies ?? []).find((row) => row.chapter === 'new' && !row.read)
  if (unreadNew) add(`new:${unreadNew.id}`, `读一张本周新研究：「${unreadNew.title_zh}」`, { kind: 'go', tab: 'codex', sub: { 'codex.tab': 'library', 'codex.chapter': 'new' } }, true)
  const missing = (c.journey.profile?.questions ?? []).find((row) => !row.answered)
  if (missing) add(`profile:${missing.key}`, `补上「${missing.label_zh}」`, { kind: 'go', tab: 'profile' }, true)
  if ((c.journey.records?.indicator_count ?? 0) === 0) add('report', '把一份体检报告交给 Pi', { kind: 'fill', text: '帮我录入这份体检报告：' }, true)
  const running = (c.codex.running ?? [])[0]
  if (running) add(`exp:${running.id}`, `今天的小实验：${running.do_zh ?? running.title_zh}`, codexTab('exp'), running.done_today !== true, running.done_today === true)
  const checkins = c.journey.plan?.checkin_items ?? []
  if (checkins.length > 0) {
    const left = checkins.filter((row) => row.done_today === null).length
    add('checkin', left > 0 ? `方案里今天的 ${checkins.length} 项，还有 ${left} 项没记` : `方案里今天的 ${checkins.length} 项都记了`, { kind: 'go', tab: 'overview' }, left > 0, left === 0)
  }
  if (deeds.reports > 0 && deeds.plans === 0) add('plan', '让 Pi 按你的结果起草一个方案', { kind: 'say', text: '按我的体检结果，帮我起草一个健康方案。' }, true)
  if (deeds.measures === 0) add('measure', '量一次腰围或血压，告诉 Pi', { kind: 'fill', text: '我今天量了：' }, true)
  if (!c.codex.started) add('codex', '打开长寿图鉴看看', codexTab('exp'), true)
  // Always something to read: the first unread card in library order, a different one each day it stays unread.
  const unread = (c.library.studies ?? []).filter((row) => !row.read)
  if (unread.length > 0) {
    const pick = unread[dayNumber(c.today) % unread.length]
    if (pick) add(`read:${pick.id}`, `读一张研究卡：「${pick.title_zh}」`, { kind: 'go', tab: 'codex', sub: { 'codex.tab': 'library', 'codex.chapter': pick.chapter } }, true)
  }
  add('ask', '问 Pi 一个关于长寿的问题', { kind: 'fill', text: '' }, true)
  return out
}

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000) || 0
}

/** Whether a thing picked this morning is done now, judged from the record (never from a claim). */
function doneNow(id: string, c: Ctx, deeds: Deeds, start: Deeds): boolean {
  const [kind, ref] = id.split(':') as [string, string | undefined]
  const studies = c.library.studies ?? []
  switch (kind) {
    case 'reveal': return (c.codex.deck ?? []).some((row) => row.id === ref && row.status === 'revealed')
    case 'pack': return (c.codex.packs ?? []).some((row) => row.id === ref && row.opened != null) || !(c.codex.packs ?? []).some((row) => row.id === ref)
    case 'new':
    case 'read': return studies.some((row) => row.id === ref && row.read)
    case 'profile': return (c.journey.profile?.questions ?? []).some((row) => row.key === ref && row.answered)
    case 'report': return deeds.reports > start.reports
    case 'exp': return (c.codex.running ?? []).some((row) => row.id === ref && row.done_today === true)
    case 'checkin': return (c.journey.plan?.checkin_items ?? []).every((row) => row.done_today !== null)
    case 'plan': return deeds.plans > start.plans
    case 'measure': return deeds.measures > start.measures
    case 'codex': return Boolean(c.codex.started)
    case 'ask': return false
    default: return false
  }
}

type Saved = {
  version: 1
  /** The highest count each deed has reached. */
  high: Partial<Deeds>
  /** Stations and medals reached, with the day. */
  stations: Record<string, string>
  medals: Record<string, string>
  /** What has been celebrated already (stations, medals, the form), so each is celebrated once. */
  celebrated: { stations: string[]; medals: string[]; form: number }
  today: { day: string; picks: string[]; texts: Record<string, string>; actions: Record<string, GameAction>; start: Partial<Deeds> } | null
}

function emptySaved(): Saved {
  return { version: 1, high: {}, stations: {}, medals: {}, celebrated: { stations: [], medals: [], form: 0 }, today: null }
}

export function gameFile(root: string): string {
  return join(root, 'game.json')
}

function readSaved(root: string): Saved {
  try {
    if (!existsSync(gameFile(root))) return emptySaved()
    const raw = JSON.parse(readFileSync(gameFile(root), 'utf8')) as Partial<Saved>
    return { ...emptySaved(), ...raw, celebrated: { ...emptySaved().celebrated, ...(raw.celebrated ?? {}) } }
  } catch {
    return emptySaved()
  }
}

function fill(partial: Partial<Deeds>): Deeds {
  const out = {} as Deeds
  for (const key of DEEDS) out[key] = partial[key] ?? 0
  return out
}

/** Highest of what was kept and what the record says now: a count never goes down. */
export function raise(kept: Partial<Deeds>, now: Deeds): Deeds {
  const out = {} as Deeds
  for (const key of DEEDS) out[key] = Math.max(kept[key] ?? 0, now[key] ?? 0)
  return out
}

export type GameView = {
  ok: true
  demo: boolean
  member: boolean
  today: string
  deeds: Deeds
  points: number
  form: { no: number; zh: string; line_zh: string; next_at: number | null; next_zh: string | null }
  stations: Array<{ id: string; no: number; title_zh: string; how_zh: string; reached: string | null }>
  reached: number
  medals: Array<{ id: string; title_zh: string; how_zh: string; earned: string | null }>
  things: Thing[]
  /** Reached but not yet celebrated: the pane plays these once and posts `game/seen`. */
  fresh: { stations: string[]; medals: string[]; form: number | null }
}

/** The view for one reading of the routes. `persist` false (demo, a family member) leaves game.json alone. */
export function gameView(c: Ctx, saved: Saved, persist: boolean): { view: GameView; saved: Saved } {
  const now = countDeeds(c)
  const deeds = persist ? raise(saved.high, now) : now
  const next: Saved = persist ? { ...saved, high: { ...deeds }, stations: { ...saved.stations }, medals: { ...saved.medals } } : saved
  const stationRows = STATIONS.map((row, i) => {
    let day = persist ? next.stations[row.id] ?? null : null
    if (!day && row.reached(deeds, c)) {
      day = c.today
      if (persist) next.stations[row.id] = day
    }
    return { id: row.id, no: i + 1, title_zh: row.title_zh, how_zh: row.how_zh, reached: day }
  })
  const medalRows = MEDALS.map((row) => {
    let day = persist ? next.medals[row.id] ?? null : null
    if (!day && row.earned(deeds, c)) {
      day = c.today
      if (persist) next.medals[row.id] = day
    }
    return { id: row.id, title_zh: row.title_zh, how_zh: row.how_zh, earned: day }
  })
  const points = total(deeds)
  const form = formOf(points)
  const after = FORMS.find((row) => row.at > points) ?? null
  // Today's three: picked once a day from the candidates and kept (done ones stay, ticked).
  let today = persist ? next.today : null
  const all = candidates(c, deeds)
  if (!today || today.day !== c.today) {
    const picks = all.filter((row) => row.open).slice(0, 3)
    today = {
      day: c.today,
      picks: picks.map((row) => row.id),
      texts: Object.fromEntries(picks.map((row) => [row.id, row.text_zh])),
      actions: Object.fromEntries(picks.map((row) => [row.id, row.action])),
      start: { ...deeds },
    }
    if (persist) next.today = today
  }
  const start = fill(today.start)
  const things: Thing[] = today.picks.map((id) => {
    const live = all.find((row) => row.id === id)
    return { id, text_zh: live?.text_zh ?? today?.texts[id] ?? '', action: live?.action ?? today?.actions[id] ?? { kind: 'go', tab: 'overview' }, done: doneNow(id, c, deeds, start) }
  })
  const fresh = persist
    ? {
      stations: stationRows.filter((row) => row.reached && !next.celebrated.stations.includes(row.id)).map((row) => row.id),
      medals: medalRows.filter((row) => row.earned && !next.celebrated.medals.includes(row.id)).map((row) => row.id),
      form: form.no > next.celebrated.form ? form.no : null,
    }
    : { stations: [], medals: [], form: null }
  return {
    view: {
      ok: true,
      demo: !persist && !c.codex.member,
      member: Boolean(c.codex.member),
      today: c.today,
      deeds,
      points,
      form: { no: form.no, zh: form.zh, line_zh: form.line_zh, next_at: after?.at ?? null, next_zh: after?.zh ?? null },
      stations: stationRows,
      reached: stationRows.filter((row) => row.reached).length,
      medals: medalRows,
      things,
      fresh,
    },
    saved: next,
  }
}

/** First-time holders who already did a lot (an existing record) see one celebration, not twelve. */
function settleBacklog(saved: Saved, view: GameView): Saved {
  if (saved.celebrated.stations.length > 0 || saved.celebrated.form > 0 || view.fresh.stations.length <= 5) return saved
  const keep = view.fresh.stations.slice(-1)
  return {
    ...saved,
    celebrated: {
      stations: view.fresh.stations.filter((id) => !keep.includes(id)),
      medals: view.fresh.medals,
      form: Math.max(0, view.form.no - 1),
    },
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

/** GET /api/longpi/game, POST /api/longpi/game/seen { stations?, medals?, form? }. */
export function registerGame(ctx: HostContext, rootDir: () => string, today: () => string): void {
  const read = async <T>(path: string): Promise<T> => {
    const out = await ctx.call('GET', path)
    return (out.status === 200 && out.json ? out.json : {}) as T
  }
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/longpi/game',
    handler: (_req, res) => {
      void (async () => {
        const [journey, codex, library, people, analysis, self] = await Promise.all([
          read<J>('/api/longpi/journey'), read<Cx>('/api/longpi/codex'), read<Lib>('/api/longpi/codex/library'),
          read<P>('/api/longpi/people'), read<An>('/api/longpi/analysis'), read<Sf>('/api/longpi/self'),
        ])
        const active = (people.people ?? []).find((row) => row.id === people.active)
        const holder = !active || active.id === 'self'
        const demo = Boolean(active?.demo)
        const c: Ctx = { journey, codex, library, people, analysis, self, today: journey.today ?? today() }
        const root = rootDir()
        const saved = readSaved(root)
        if (holder) {
          let { view, saved: next } = gameView(c, saved, true)
          const settled = settleBacklog(next, view)
          if (settled !== next) ({ view, saved: next } = gameView(c, settled, true))
          writeFileSync(gameFile(root), `${JSON.stringify(next, null, 1)}\n`)
          sendJson(res, 200, view)
          return
        }
        if (demo) {
          sendJson(res, 200, gameView(c, emptySaved(), false).view)
          return
        }
        // A family member's record is shown: the holder's own game, as it was last seen.
        const kept = fill(saved.high)
        const form = formOf(total(kept))
        const after = FORMS.find((row) => row.at > total(kept)) ?? null
        sendJson(res, 200, {
          ok: true, demo: false, member: true, today: c.today, deeds: kept, points: total(kept),
          form: { no: form.no, zh: form.zh, line_zh: form.line_zh, next_at: after?.at ?? null, next_zh: after?.zh ?? null },
          stations: STATIONS.map((row, i) => ({ id: row.id, no: i + 1, title_zh: row.title_zh, how_zh: row.how_zh, reached: saved.stations[row.id] ?? null })),
          reached: Object.keys(saved.stations).length,
          medals: MEDALS.map((row) => ({ id: row.id, title_zh: row.title_zh, how_zh: row.how_zh, earned: saved.medals[row.id] ?? null })),
          things: [],
          fresh: { stations: [], medals: [], form: null },
        } satisfies GameView)
      })().catch((error) => sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }))
    },
  })
  ctx.webServer.register({
    kind: 'exact',
    path: '/api/longpi/game/seen',
    handler: (req, res) => {
      let body = ''
      req.on('data', (chunk: Uint8Array) => { body += new TextDecoder().decode(chunk) })
      req.on('end', () => {
        try {
          const input = (body ? JSON.parse(body) : {}) as { stations?: string[]; medals?: string[]; form?: number }
          const root = rootDir()
          const saved = readSaved(root)
          const next: Saved = {
            ...saved,
            celebrated: {
              stations: [...new Set([...saved.celebrated.stations, ...(input.stations ?? [])])],
              medals: [...new Set([...saved.celebrated.medals, ...(input.medals ?? [])])],
              form: Math.max(saved.celebrated.form, input.form ?? 0),
            },
          }
          writeFileSync(gameFile(root), `${JSON.stringify(next, null, 1)}\n`)
          sendJson(res, 200, { ok: true })
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      })
    },
  })
}
