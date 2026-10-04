// 自测 (client/self-measure.ts): waist, home blood pressure and weight the person measures, saved as stated (units
// converted on the server) and never estimated. In the pane each field saves on Enter; a unit can be typed after the
// number (140 斤, 2.6 尺), as the web page's unit list offered.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { pad } from '../../kit.tsx'
import { Err, Field, LABEL, Note, Ok, Subhead } from './ui.tsx'
import type { Journey, SelfKey, SelfKeySpec, SelfLatest, SelfRow } from './types.ts'
import { day, errorOf, fmt, isoOf, numberOf, setSub, sub } from './util.ts'

const PREFERRED: Record<SelfKey, string[]> = { waist: ['cm', '尺', '寸', 'in'], sbp: ['mmHg'], dbp: ['mmHg'], weight: ['kg', '斤', 'lb'] }

const FALLBACK: ReadonlyArray<SelfKeySpec> = [
  { key: 'waist', label_zh: '腰围', unit: 'cm', units: PREFERRED.waist },
  { key: 'sbp', label_zh: '收缩压', unit: 'mmHg', units: PREFERRED.sbp },
  { key: 'dbp', label_zh: '舒张压', unit: 'mmHg', units: PREFERRED.dbp },
  { key: 'weight', label_zh: '体重', unit: 'kg', units: PREFERRED.weight },
]

export const BP_NOTE = '家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。建议早晚各测一次，每次坐位休息 5 分钟后测量。'

function specOf(journey: Journey | null, key: SelfKey): SelfKeySpec {
  return journey?.self.keys.find((row) => row.key === key) ?? (FALLBACK.find((row) => row.key === key) as SelfKeySpec)
}

export function labelOf(key: SelfKey): string {
  return FALLBACK.find((row) => row.key === key)?.label_zh ?? key
}

export function selfLatestText(row: SelfLatest, all: readonly SelfLatest[]): string {
  if (row.key === 'sbp') {
    const dbp = all.find((item) => item.key === 'dbp')
    return `${fmt(row.value)}${dbp ? `/${fmt(dbp.value)}` : ''} ${row.unit}`
  }
  return `${fmt(row.value)} ${row.unit}`
}

/** "86 cm" / "2.6尺" / "70.5" → value and unit (the spec's own unit when none is typed). */
function parseWithUnit(text: string, spec: SelfKeySpec): { value: number; unit: string } | { error: string } | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const match = /^([\d.,，]+)\s*(.*)$/.exec(trimmed)
  if (!match) return { error: `${spec.label_zh}请填写数字。` }
  const value = numberOf(match[1] ?? '')
  if (value === null || Number.isNaN(value)) return { error: `${spec.label_zh}请填写数字。` }
  const typed = (match[2] ?? '').trim()
  if (!typed) return { value, unit: spec.unit }
  const known = [...spec.units, ...PREFERRED[spec.key]].find((unit) => unit.toLowerCase() === typed.toLowerCase())
  if (!known) return { error: `${spec.label_zh}的单位可以写 ${PREFERRED[spec.key].join('、')}。` }
  return { value, unit: known }
}

type Entry = { key: SelfKey; value: number; unit: string; date?: string }

/** POST self; the outcome is said under the form (and a toast when something was saved). */
export async function saveEntries(ctx: Ctx, entries: Entry[], scope: string): Promise<void> {
  setSub(ctx, `${scope}.error`, '')
  setSub(ctx, `${scope}.msg`, '')
  const out = await ctx.act.post('self', { entries }, { reload: ['self', 'journey', 'tracking'], quiet: true })
  const saved = Array.isArray(out.json.saved) ? out.json.saved.length : 0
  const problems = Array.isArray(out.json.problems) ? (out.json.problems as unknown[]).map(String) : []
  if (out.ok) {
    ctx.act.toast(`已记录 ${saved} 项。`)
    if (problems.length > 0) setSub(ctx, `${scope}.msg`, `已记录 ${saved} 项；${problems.join(' ')}`)
  } else {
    setSub(ctx, `${scope}.error`, problems.length > 0 ? problems.join(' ') : errorOf(out.json, '记录失败，请稍后再试。'))
  }
}

/** Blood pressure typed as 128/82 (or 128 82). */
function parseBp(text: string): { sbp: number; dbp: number } | { error: string } | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/[\s/／,，]+/).filter(Boolean)
  if (parts.length !== 2) return { error: '血压请同时填写收缩压和舒张压（高压和低压），例如 128/82。' }
  const sbp = numberOf(parts[0] ?? '')
  const dbp = numberOf(parts[1] ?? '')
  if (sbp === null || dbp === null || Number.isNaN(sbp) || Number.isNaN(dbp)) return { error: '血压请填写数字，例如 128/82。' }
  return { sbp, dbp }
}

/** The fields for one measurement kind, shared by the 自测 form and the add-on list (scope says where errors go). */
export function selfField(ctx: Ctx, journey: Journey | null, key: 'waist' | 'weight' | 'bp', scope: string, date?: string): RenderElement {
  const draft = `${scope}.d.${key}`
  if (key === 'bp') {
    return Field(ctx, {
      key: `${scope}-bp`, label: '家庭血压', value: sub(ctx, draft), placeholder: '收缩压/舒张压，例如 128/82 mmHg', submitLabel: '记录',
      onSubmit: (text) => {
        setSub(ctx, draft, '')
        const bp = parseBp(text)
        if (bp === null) return
        if ('error' in bp) {
          setSub(ctx, draft, text.trim())
          setSub(ctx, `${scope}.error`, bp.error)
          return
        }
        void saveEntries(ctx, [{ key: 'sbp', value: bp.sbp, unit: 'mmHg', ...(date ? { date } : {}) }, { key: 'dbp', value: bp.dbp, unit: 'mmHg', ...(date ? { date } : {}) }], scope)
      },
    })
  }
  const spec = specOf(journey, key)
  return Field(ctx, {
    key: `${scope}-${key}`, label: spec.label_zh, value: sub(ctx, draft), placeholder: key === 'waist' ? `例如 86（${spec.unit}）` : `例如 70.5（${spec.unit}）`, submitLabel: '记录',
    onSubmit: (text) => {
      setSub(ctx, draft, '')
      const parsed = parseWithUnit(text, spec)
      if (parsed === null) return
      if ('error' in parsed) {
        setSub(ctx, draft, text.trim())
        setSub(ctx, `${scope}.error`, parsed.error)
        return
      }
      void saveEntries(ctx, [{ key, value: parsed.value, unit: parsed.unit, ...(date ? { date } : {}) }], scope)
    },
  })
}

export function selfSummary(journey: Journey | null): string {
  const latest = (journey?.self.latest ?? []).filter((row) => row.key !== 'dbp')
  if (latest.length === 0) return '还没有自测记录'
  return latest.map((row) => `${row.key === 'sbp' ? '血压' : row.label_zh} ${selfLatestText(row, journey?.self.latest ?? [])}`).join(' · ')
}

export function SelfSection(ctx: Ctx, journey: Journey): Node[] {
  const E = ctx.E
  const { Box, Text, Button } = E
  const latest = journey.self.latest.filter((row) => row.key !== 'dbp')
  const date = sub(ctx, 'self.date') || ctx.today
  const log = ctx.route('self')
  const rows = ((ctx.json<{ rows?: SelfRow[] }>('self')?.rows) ?? []).slice(0, 6)

  const remove = async (row: SelfRow) => {
    const what = `${day(ctx, row.date)}的${labelOf(row.key)} ${fmt(row.value)} ${row.unit}`
    const answer = await ctx.act.ask(`删除 ${what}？`, ['删除', '取消'], '删除自测')
    if (answer !== '删除') return
    const out = await ctx.act.post(`self?id=${encodeURIComponent(row.id)}`, undefined, { method: 'DELETE', reload: ['self', 'journey', 'tracking'], done: `已删除 ${day(ctx, row.date)}的${labelOf(row.key)}。`, quiet: true })
    if (!out.ok) ctx.act.toast(`删除失败：${errorOf(out.json, '请稍后再试')}`)
  }

  const recent: Node[] = (() => {
    if (!log || (log.loading && log.json === null)) return []
    if (log.status !== 200) return [Err(E, `自测记录没有读到：${log.error || '请稍后再试'}`, 'self-log-err')]
    if (rows.length === 0) return [Note(E, '还没有自测记录。', 'self-none')]
    return [
      Subhead(E, '最近记录', 'self-recent-head'),
      ...rows.map((row) => (
        <Box key={`self-row-${row.id}`} flexDirection="row" justifyContent="space-between" width={ctx.width - 2}>
          <Box flexDirection="row">
            <Text>{`${pad(labelOf(row.key), 8)}${fmt(row.value)} ${row.unit}`}</Text>
            {row.given ? <Text dimColor wrap="truncate-end">{`（原始填写 ${fmt(row.given.value)} ${row.given.unit}）`}</Text> : null}
          </Box>
          <Box flexDirection="row" gap={1}>
            <Text dimColor>{day(ctx, row.date)}</Text>
            <Button key={`self-del-${row.id}`} plain dimColor label="删除" onPress={() => { void remove(row) }} />
          </Box>
        </Box>
      )),
    ]
  })()

  return [
    ...latest.map((row) => (
      <Box key={`self-latest-${row.key}`} flexDirection="row">
        <Text dimColor>{pad(row.key === 'sbp' ? '家庭血压' : row.label_zh, LABEL + 2)}</Text>
        <Text bold>{selfLatestText(row, journey.self.latest)}</Text>
        <Text dimColor>{`  ${row.key === 'sbp' ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : '1 次读数'} · 截至 ${day(ctx, row.date)}` : day(ctx, row.date)}`}</Text>
      </Box>
    )),
    latest.length > 0 ? <Text key="self-gap"> </Text> : null,
    selfField(ctx, journey, 'waist', 'self', date),
    selfField(ctx, journey, 'weight', 'self', date),
    selfField(ctx, journey, 'bp', 'self', date),
    Field(ctx, {
      key: 'self-date', label: '测量日期', value: date, placeholder: ctx.today, submitLabel: '改日期',
      hint: date === ctx.today ? '默认今天；补记以前的，先改日期再填数值。' : `之后记录的都算作 ${day(ctx, date)}。`,
      onSubmit: (text) => {
        const iso = isoOf(text)
        if (!iso || iso > ctx.today || iso < '1990-01-01') {
          setSub(ctx, 'self.error', '日期请写成 2026-10-04 这样，不能晚于今天。')
          return
        }
        setSub(ctx, 'self.error', '')
        setSub(ctx, 'self.date', iso === ctx.today ? '' : iso)
      },
    }),
    Err(E, sub(ctx, 'self.error'), 'self-err'),
    Ok(E, sub(ctx, 'self.msg'), 'self-msg'),
    Note(E, '填好一项按回车就记录。单位可选斤、尺或寸，将自动换算为 kg 和 cm（例如 140 斤）。', 'self-units'),
    <Text key="self-bp-note" dimColor wrap="wrap">{BP_NOTE}</Text>,
    ...recent,
  ]
}
