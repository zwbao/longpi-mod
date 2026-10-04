import { describe, expect, test } from 'claude-code/testing'

import { countDeeds, formOf, gameView, raise, total } from '../hooks/app/game.ts'

// The game's rules on their own: Pi's forms, counts that never go down, check-ins that earn nothing, and
// today's three things picked once a day.

type Ctx = Parameters<typeof countDeeds>[0]

function ctx(over: Partial<{ checkups: number; read: number; plan: boolean; checkins: Array<boolean | null>; today: string; ready: boolean }> = {}): Ctx {
  const studies = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, chapter: i < 6 ? 'clock' : 'organ', title_zh: `卡 ${i}`, read: i < (over.read ?? 0) }))
  return {
    today: over.today ?? '2026-10-05',
    journey: {
      profile: { complete: true, questions: [{ key: 'age', label_zh: '年龄', answered: true }] },
      records: { indicator_count: (over.checkups ?? 0) > 0 ? 30 : 0, summary: { checkups: over.checkups ?? 0, first_date: '2026-01-02', last_date: '2026-08-01' } },
      results: { bioage: { status: (over.checkups ?? 0) > 0 ? 'ok' : 'blocked' } },
      method_results: [],
      plan: over.plan ? { exists: true, version: 1, checkin_items: (over.checkins ?? []).map((done, i) => ({ id: `c${i}`, title: `项 ${i}`, done_today: done })) } : { exists: false },
    },
    codex: { started: true, deck: [], running: [], ready: over.ready ? [{ id: 'r1', experiment_id: 'walk', title_zh: '饭后走 10 分钟', status: 'ready' }] : [], packs: [], footprints: [] },
    library: { studies, species: [], chapters: [{ id: 'clock', title_zh: '身体的钟' }, { id: 'organ', title_zh: '器官' }] },
    people: { active: 'self', people: [{ id: 'self' }] },
    analysis: {},
    self: { rows: [] },
  }
}

const EMPTY = { version: 1 as const, high: {}, stations: {}, medals: {}, celebrated: { stations: [], medals: [], form: 0 }, today: null }

describe('通往 120', () => {
  test('Pi grows at 3, 15, 50 and 150 things done', () => {
    expect(formOf(0).no).toBe(0)
    expect(formOf(2).no).toBe(0)
    expect(formOf(3).no).toBe(1)
    expect(formOf(15).no).toBe(2)
    expect(formOf(49).no).toBe(2)
    expect(formOf(50).no).toBe(3)
    expect(formOf(150).no).toBe(4)
  })

  test('a count never goes down when the record shrinks', () => {
    const first = gameView(ctx({ checkups: 2, read: 6 }), EMPTY, true)
    expect(first.view.deeds.cards).toBe(6)
    expect(first.view.deeds.reports).toBe(2)
    // a re-import with fewer checkups and a reset library: the kept highs stay
    const second = gameView(ctx({ checkups: 1, read: 0 }), first.saved, true)
    expect(second.view.deeds.cards).toBe(6)
    expect(second.view.deeds.reports).toBe(2)
    expect(second.view.points).toBeGreaterThanOrEqual(first.view.points)
    expect(raise({ cards: 9 }, countDeeds(ctx({ read: 2 }))).cards).toBe(9)
  })

  test('check-ins earn nothing: answering every item leaves the total where it was', () => {
    const open = countDeeds(ctx({ checkups: 1, plan: true, checkins: [null, null, null] }))
    const answered = countDeeds(ctx({ checkups: 1, plan: true, checkins: [true, true, true] }))
    expect(total(answered)).toBe(total(open))
  })

  test('stations are reached by things done and stay reached', () => {
    const before = gameView(ctx(), EMPTY, true)
    expect(before.view.stations.find((row) => row.id === 'report')?.reached).toBe(null)
    const after = gameView(ctx({ checkups: 1 }), before.saved, true)
    expect(after.view.stations.find((row) => row.id === 'report')?.reached).toBe('2026-10-05')
    expect(after.view.fresh.stations).toContain('report')
    const later = gameView(ctx({ checkups: 0, today: '2026-10-09' }), after.saved, true)
    expect(later.view.stations.find((row) => row.id === 'report')?.reached).toBe('2026-10-05')
  })

  test("today's three are picked once a day and kept, ticked when the record shows them done", () => {
    const morning = gameView(ctx({ ready: true, read: 0 }), EMPTY, true)
    expect(morning.view.things.length).toBe(3)
    expect(morning.view.things[0]?.id).toBe('reveal:r1')
    const ids = morning.view.things.map((row) => row.id)
    const readId = ids.find((id) => id.startsWith('read:'))
    // later the same day: the card was read, the picks are the same, that one is ticked
    const read = readId ? Number(readId.slice('read:s'.length)) + 1 : 0
    const evening = gameView(ctx({ ready: true, read }), morning.saved, true)
    expect(evening.view.things.map((row) => row.id)).toEqual(ids)
    if (readId) expect(evening.view.things.find((row) => row.id === readId)?.done).toBe(true)
    // the next day: picked afresh
    const tomorrow = gameView(ctx({ ready: false, read, today: '2026-10-06' }), evening.saved, true)
    expect(tomorrow.view.things.some((row) => row.id === 'reveal:r1')).toBe(false)
  })

  test('the demo is never saved', () => {
    const demo = gameView(ctx({ checkups: 2 }), EMPTY, false)
    expect(demo.saved).toBe(EMPTY)
    expect(demo.view.fresh.stations).toEqual([])
  })
})
