// 高级：方法库 (client/methods.ts): what the record can run now, what one more test would unlock, the medication
// plan the record holds, recent results, a search over the library, this week's runs and the questions it answers.
// Method ids never show: a method is named by what it computes.

import type { Ctx, Node } from '../../types.ts'
import { Buttons, C, fit, num, pad } from '../../kit.tsx'
import { Err, Field, Note, Ok, Subhead } from './ui.tsx'
import { day, errorOf, setSub, sub } from './util.ts'

type Board = {
  skills?: { version?: string }
  readiness?: { ready?: Array<{ name: string; blurb?: string; domain?: string }>; unlock?: Array<{ item: string; skills: string[] }>; declared?: number }
  records?: { medications?: Array<{ name?: string; status?: string }> }
  readouts?: Array<{ key: string; label_zh?: string; value?: number | string | null; unit?: string; at?: string; measured_at?: string }>
  dispatch?: { matches?: Array<{ name: string; blurb?: string; domain?: string }> }
}
type Match = { name: string; blurb?: string; why?: string[] }
type Stats = { since?: string; runs?: number; skills?: Array<{ skill: string; runs: number; ok: number }> }
type Intents = { version?: string; intents?: Array<{ id: string; label: string; skills: string[] }> }

export const METHOD_ROUTES = ['board', 'stats', 'intents']

const STATUS_ZH: Record<string, string> = { active: '在用', paused: '暂停', stopped: '已停', completed: '已结束', planned: '计划中' }

export function matchRoute(ctx: Ctx | { view: { sub: Record<string, string> } }): string | null {
  const q = ctx.view.sub['more.methods.q'] ?? ''
  return q ? `match?q=${encodeURIComponent(q)}` : null
}

/** What a method computes, from what the board says about it; never its id. */
function blurbOf(board: Board | null, name: string): string {
  const all = [...(board?.readiness?.ready ?? []), ...(board?.dispatch?.matches ?? [])]
  return all.find((row) => row.name === name)?.blurb ?? ''
}

function unitText(unit: string | undefined): string {
  if (!unit || unit === '1') return ''
  return unit === 'a' || unit === 'yr' ? '岁' : unit
}

export function MethodsSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Box, Text } = E
  const cached = ctx.route('board')
  const board = ctx.json<Board>('board')
  if (!board) {
    if (!cached || cached.loading) return [Note(ctx, '正在读取方法库…', 'm-loading')]
    return [Err(ctx, `方法库没有读到：${cached.error || '请稍后再试'}`, 'm-failed'), Buttons(E, [{ key: 'm-retry', label: '重试', onPress: () => ctx.act.load(['board'], true) }], 'm-retry-row')]
  }
  const ready = board.readiness?.ready ?? []
  const unlock = board.readiness?.unlock ?? []
  const meds = board.records?.medications ?? []
  const readouts = board.readouts ?? []
  const w = ctx.width - 2
  const running = sub(ctx, 'methods.running') === '1'
  const results = sub(ctx, 'methods.results')

  const run = async () => {
    setSub(ctx, 'methods.running', '1')
    setSub(ctx, 'methods.results', '')
    const out = await ctx.act.post('run-ready', {}, { reload: ['board', 'stats', 'tracking'], quiet: true })
    setSub(ctx, 'methods.running', '')
    if (!out.ok) {
      setSub(ctx, 'methods.results', `!计算未完成：${errorOf(out.json, '请稍后再试')}`)
      return
    }
    const rows = Array.isArray(out.json.results) ? out.json.results as Array<{ skill: string; ok: boolean; excerpt?: string }> : []
    const done = rows.filter((row) => row.ok).length
    const lines = rows.map((row) => `${row.ok ? '✓' : '·'} ${blurbOf(board, row.skill) || '一个方法'}`)
    setSub(ctx, 'methods.results', [`算完 ${done} 项${rows.length > done ? `，${rows.length - done} 项没有算出` : ''}。`, ...lines].join('\n'))
  }

  // 找方法
  const q = sub(ctx, 'methods.q')
  const path = matchRoute(ctx)
  const matchState = path ? ctx.route(path) : undefined
  const matchJson = path ? ctx.json<{ matches?: Match[]; note?: string; error?: string }>(path) : null
  const shown: Match[] = matchJson?.matches ?? (q ? [] : (board.dispatch?.matches ?? []))

  // 本周运行
  const stats = ctx.json<Stats>('stats')
  const runs = stats?.runs ?? 0
  const okRuns = (stats?.skills ?? []).reduce((n, row) => n + row.ok, 0)
  const failing = (stats?.skills ?? []).filter((row) => row.ok < row.runs).map((row) => blurbOf(board, row.skill)).filter(Boolean)

  const intents = ctx.json<Intents>('intents')?.intents ?? []

  return [
    Note(ctx, `方法库 ${board.skills?.version ?? ''} · ${board.readiness?.declared ?? 0} 个个人方法。在对话中同样可以使用。`, 'm-lead'),

    Subhead(E, '可用现有记录计算', 'm-ready-head', '', false),
    ...(ready.length === 0
      ? [Note(ctx, '还没有能直接计算的方法。', 'm-ready-none')]
      : ready.slice(0, 8).map((row, i) => (
        <Box key={`m-ready-${i}`} flexDirection="row" justifyContent="space-between" width={w}>
          <Text>{fit(row.blurb || '一个方法', Math.max(10, w - 18))}</Text>
          <Text dimColor>{fit(row.domain ?? '', 16)}</Text>
        </Box>
      ))),
    ready.length > 8 ? Note(ctx, `另有 ${ready.length - 8} 项`, 'm-ready-more') : null,
    ready.length > 0 ? Buttons(E, [{ key: 'm-run', label: running ? '正在计算…' : `一键计算 ${ready.length} 项`, primary: true, onPress: () => { if (!running) void run() } }], 'm-run-row') : null,
    results.startsWith('!') ? Err(ctx, results.slice(1), 'm-results') : results ? Ok(ctx, results, 'm-results') : null,

    Subhead(E, '再测一项即可解锁', 'm-unlock-head'),
    ...(unlock.length === 0
      ? [Note(ctx, '没有只差一项的方法。', 'm-unlock-none')]
      : unlock.slice(0, 8).map((row, i) => (
        <Box key={`m-unlock-${i}`} flexDirection="row" gap={2}>
          <Text bold>{row.item}</Text>
          <Text dimColor>{`解锁 ${row.skills.length} 个方法`}</Text>
        </Box>
      ))),

    Subhead(E, '用药计划', 'm-meds-head', '只读，来自健康记录里的用药计划'),
    ...(meds.length === 0
      ? [Note(ctx, '未读取到用药计划。', 'm-meds-none')]
      : meds.map((row, i) => (
        <Box key={`m-med-${i}`} flexDirection="row" justifyContent="space-between" width={w}>
          <Text>{row.name ?? ''}</Text>
          <Text dimColor>{STATUS_ZH[row.status ?? ''] ?? row.status ?? ''}</Text>
        </Box>
      ))),

    Subhead(E, '最近结果', 'm-readouts-head'),
    ...(readouts.length === 0
      ? [Note(ctx, '尚未计算。', 'm-readouts-none')]
      : readouts.slice(0, 8).map((row, i) => {
        const value = typeof row.value === 'number' ? num(row.value, 2) : String(row.value ?? '')
        const when = day(ctx, row.measured_at || row.at || '')
        const right = `${value} ${unitText(row.unit)}`.trim()
        return (
          <Box key={`m-readout-${i}`} flexDirection="row" justifyContent="space-between" width={w}>
            <Text wrap="truncate-end">{fit(row.label_zh || '结果', Math.max(10, w - 30))}</Text>
            <Box flexDirection="row" gap={2}>
              <Text>{right}</Text>
              <Text dimColor>{pad(when, 12)}</Text>
            </Box>
          </Box>
        )
      })),

    Subhead(E, '找方法', 'm-search-head'),
    Field(ctx, {
      key: 'm-q', label: '想知道什么', value: q, placeholder: '例如：生物年龄、甲基化、NMN 有用吗', submitLabel: '匹配',
      onSubmit: (text) => setSub(ctx, 'methods.q', text.trim()),
    }),
    path && matchState && matchState.loading && !matchJson ? Note(ctx, '匹配中…', 'm-matching') : null,
    path && matchState && !matchState.loading && matchState.status !== 200 ? Err(ctx, `匹配失败：${matchState.error || '请稍后再试'}`, 'm-match-err') : null,
    matchJson?.note ? Note(ctx, matchJson.note, 'm-match-note') : null,
    path && matchJson && shown.length === 0 ? Note(ctx, '没有找到相关的方法。', 'm-match-none') : null,
    q ? null : shown.length > 0 ? Note(ctx, '按你的记录，先推荐这几个：', 'm-suggest') : null,
    ...shown.slice(0, q ? 6 : 3).map((item, i) => (
      <Box key={`m-match-${i}`} flexDirection="column">
        <Text bold>{fit(item.blurb || '一个方法', w)}</Text>
        {(item.why ?? []).length > 0 ? <Text dimColor wrap="truncate-end">{fit((item.why ?? []).join('；'), w)}</Text> : null}
      </Box>
    )),

    Subhead(E, '本周运行', 'm-stats-head', stats?.since ? `${day(ctx, stats.since)}起` : ''),
    stats
      ? Note(ctx, runs === 0 ? '这一周还没有计算过。' : `计算 ${runs} 次，成功 ${okRuns} 次${failing.length > 0 ? `；没算完的：${failing.join('、')}` : runs > okRuns ? `；${runs - okRuns} 次没算完` : ''}。`, 'm-stats')
      : Note(ctx, '正在读取…', 'm-stats-loading'),

    Subhead(E, '方法库能回答的问题', 'm-intents-head', intents.length > 0 ? '按一下，放进对话框' : ''),
    ...(intents.length === 0
      ? [Note(ctx, '正在读取…', 'm-intents-loading')]
      : [(
        <Box key="m-intents" flexDirection="row" flexWrap="wrap" columnGap={2} width={w}>
          {intents.map((row) => {
            const { Button } = E
            return <Button key={`m-intent-${row.id}`} plain label={`${row.label}（${row.skills.length}）`} onPress={() => ctx.act.fill(`用方法库帮我看看：${row.label}`)} />
          })}
        </Box>
      )]),
    <Text key="m-gap" color={C.dim}> </Text>,
  ]
}
