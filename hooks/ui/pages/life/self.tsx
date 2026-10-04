// What the person measures at home: waist, blood pressure, weight (client/self-measure.ts). The latest values,
// a small form (saved as stated, units converted by LongPi), and the recent entries with 删除. Shown under
// 体格与血压 on 化验, where the saved values join that group.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, pad, zh } from '../../kit.tsx'
import { indicatorsPath, selfOf, selfRowsOf, type SelfKey, type SelfKeySpec, type SelfLatest } from './data.ts'
import { dateZh, fmt } from './plain.ts'

const PREFERRED_UNITS: Record<SelfKey, string[]> = { waist: ['cm', '尺', '寸', 'in'], sbp: ['mmHg'], dbp: ['mmHg'], weight: ['kg', '斤', 'lb'] }

const SELF_FALLBACK: readonly SelfKeySpec[] = [
  { key: 'waist', label_zh: '腰围', unit: 'cm', units: PREFERRED_UNITS.waist },
  { key: 'sbp', label_zh: '收缩压', unit: 'mmHg', units: PREFERRED_UNITS.sbp },
  { key: 'dbp', label_zh: '舒张压', unit: 'mmHg', units: PREFERRED_UNITS.dbp },
  { key: 'weight', label_zh: '体重', unit: 'kg', units: PREFERRED_UNITS.weight },
]

const BP_NOTE = '家庭血压按最近 7 天的平均值来判断（欧洲高血压学会的做法），单次读数只作参考。建议早晚各测一次，每次坐位休息 5 分钟后测量。'
const K = (name: string) => `life.self.${name}`

function specOf(keys: readonly SelfKeySpec[], key: SelfKey): SelfKeySpec {
  return keys.find((row) => row.key === key) ?? (SELF_FALLBACK.find((row) => row.key === key) as SelfKeySpec)
}

function unitChoices(spec: SelfKeySpec): string[] {
  const offered = spec.units.length > 0 ? spec.units : [spec.unit]
  const preferred = PREFERRED_UNITS[spec.key].filter((unit) => offered.some((item) => item.toLowerCase() === unit.toLowerCase()))
  return [...new Set([spec.unit, ...preferred])]
}

function labelOf(key: SelfKey): string {
  return SELF_FALLBACK.find((row) => row.key === key)?.label_zh ?? key
}

function latestText(row: SelfLatest, all: readonly SelfLatest[]): string {
  if (row.key === 'sbp') {
    const dbp = all.find((item) => item.key === 'dbp')
    return `${fmt(row.value)}${dbp ? `/${fmt(dbp.value)}` : ''} ${row.unit}`
  }
  return `${fmt(row.value)} ${row.unit}`
}

function numberOf(text: string): number | null {
  const trimmed = text.trim().replace(/，/g, '.').replace(/,/g, '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : Number.NaN
}

/** 「135/85」「135 85」「135／85」: the two numbers of a blood pressure. */
function pressureOf(text: string): { sbp: number; dbp: number } | null | 'bad' {
  const trimmed = text.trim()
  if (!trimmed) return null
  const parts = trimmed.split(/\s*[/／\s]\s*/).filter(Boolean)
  if (parts.length !== 2) return 'bad'
  const sbp = Number(parts[0])
  const dbp = Number(parts[1])
  return Number.isFinite(sbp) && Number.isFinite(dbp) && sbp > 0 && dbp > 0 ? { sbp, dbp } : 'bad'
}

/** Save the form. `typed` is the field just submitted with Enter (its last keystrokes may not be in `sub` yet). */
async function submit(ctx: Ctx, keys: readonly SelfKeySpec[], typed: Record<string, string> = {}): Promise<void> {
  const sub = { ...ctx.view.sub, ...typed }
  const date = (sub[K('date')] ?? '').trim() || ctx.today
  const fail = (text: string) => ctx.act.setSub(K('error'), text)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > ctx.today) return fail(`测量日期请写成 ${ctx.today} 这样，且不晚于今天。`)
  const entries: Array<{ key: SelfKey; value: number; unit: string; date: string }> = []
  for (const key of ['waist', 'weight'] as const) {
    const value = numberOf(sub[K(key)] ?? '')
    if (value == null) continue
    if (Number.isNaN(value)) return fail(`${specOf(keys, key).label_zh}请填写数字。`)
    entries.push({ key, value, unit: sub[K(`${key}.unit`)] || specOf(keys, key).unit, date })
  }
  const bp = pressureOf(sub[K('bp')] ?? '')
  if (bp === 'bad') return fail('血压请同时填写收缩压和舒张压（高压和低压），例如 135/85。')
  if (bp) entries.push({ key: 'sbp', value: bp.sbp, unit: 'mmHg', date }, { key: 'dbp', value: bp.dbp, unit: 'mmHg', date })
  if (entries.length === 0) return fail('请至少填写一项后再记录。')
  fail('')
  const result = await ctx.act.post('self', { entries }, { reload: ['self', indicatorsPath('labs')], quiet: true })
  const saved = Array.isArray(result.json.saved) ? result.json.saved.length : 0
  const problems = Array.isArray(result.json.problems) ? result.json.problems.filter((item): item is string => typeof item === 'string') : []
  if (saved === 0) return fail(problems.length > 0 ? problems.join(' ') : typeof result.json.error === 'string' ? result.json.error : '记录失败，请稍后再试。')
  for (const name of ['waist', 'weight', 'bp', 'date']) ctx.act.setSub(K(name), '')
  ctx.act.setSub(K('gen'), String(Number(sub[K('gen')] ?? '0') + 1))
  ctx.act.toast(problems.length > 0 ? `已记录 ${saved} 项；${problems.join(' ')}` : `已记录 ${saved} 项。`)
}

function form(ctx: Ctx, keys: readonly SelfKeySpec[]): RenderElement {
  const { Box, Text, Button } = ctx.E
  const E = ctx.E as typeof ctx.E & { Input?: unknown; Select?: unknown }
  const gen = ctx.view.sub[K('gen')] ?? '0'
  const error = ctx.view.sub[K('error')] ?? ''
  if (!('Input' in ctx.E)) {
    return (
      <Box key="self-form" flexDirection="column">
        <Text dimColor wrap="wrap">{zh('这里不能直接输入。可以在对话里告诉 Claude，例如「今天腰围 88 厘米，血压 132/84」。')}</Text>
        <Button key="self-say" label="在对话里记录" onPress={() => ctx.act.fill('帮我记一下自测：腰围  厘米，血压  /  ，体重  公斤')} />
      </Box>
    )
  }
  const Input = E.Input as (props: Record<string, unknown>) => RenderElement
  const Select = ('Select' in ctx.E ? E.Select : null) as ((props: Record<string, unknown>) => RenderElement) | null
  const field = (name: 'waist' | 'weight', placeholder: string) => {
    const spec = specOf(keys, name)
    const choices = unitChoices(spec)
    const unit = ctx.view.sub[K(`${name}.unit`)] || spec.unit
    return (
      <Box key={`f-${name}`} flexDirection="row" gap={1}>
        <Text>{pad(spec.label_zh, 8)}</Text>
        <Input key={`self-${name}-${gen}`} placeholder={placeholder} submitLabel="记录" onInput={(value: string) => ctx.act.setSub(K(name), value)} onSubmit={(value: string) => { ctx.act.setSub(K(name), value); void submit(ctx, keys, { [K(name)]: value }) }} />
        {Select && choices.length > 1
          ? <Select key={`self-${name}-unit`} options={choices.map((value) => ({ value, label: value }))} value={unit} onSelect={(value: string) => ctx.act.setSub(K(`${name}.unit`), value)} />
          : <Text dimColor>{spec.unit}</Text>}
      </Box>
    )
  }
  return (
    <Box key="self-form" flexDirection="column" marginTop={1}>
      {field('waist', '例如 86')}
      {field('weight', '例如 70.5')}
      <Box key="f-bp" flexDirection="row" gap={1}>
        <Text>{pad('家庭血压', 8)}</Text>
        <Input key={`self-bp-${gen}`} placeholder="收缩压/舒张压，例如 135/85" submitLabel="记录" onInput={(value: string) => ctx.act.setSub(K('bp'), value)} onSubmit={(value: string) => { ctx.act.setSub(K('bp'), value); void submit(ctx, keys, { [K('bp')]: value }) }} />
        <Text dimColor>mmHg</Text>
      </Box>
      <Box key="f-date" flexDirection="row" gap={1}>
        <Text>{pad('测量日期', 8)}</Text>
        <Input key={`self-date-${gen}`} placeholder={`${ctx.today}（不填就是今天）`} submitLabel="记录" onInput={(value: string) => ctx.act.setSub(K('date'), value)} onSubmit={(value: string) => { ctx.act.setSub(K('date'), value); void submit(ctx, keys, { [K('date')]: value }) }} />
      </Box>
      {error ? <Text key="self-error" color={C.bad} wrap="wrap">{zh(error)}</Text> : null}
      <Box key="f-actions" flexDirection="row" gap={1}>
        <Button key="self-save" variant="primary" label="记录" onPress={() => { void submit(ctx, keys) }} />
        <Text dimColor wrap="wrap">{zh('单位可选斤、尺或寸，将自动换算为 kg 和 cm。')}</Text>
      </Box>
      <Text key="bp-note" dimColor wrap="wrap">{zh(BP_NOTE)}</Text>
    </Box>
  )
}

function recent(ctx: Ctx): Node {
  const { Box, Text, Button } = ctx.E
  const cached = ctx.route('self')
  if (!cached || (cached.loading && cached.json == null)) return <Text key="self-recent" dimColor>正在读取自测记录…</Text>
  if (cached.status !== 200) return <Text key="self-recent" color={C.warn}>{`自测记录没有读到：${cached.error || cached.status}`}</Text>
  const rows = selfRowsOf(cached.json).slice(0, 6)
  if (rows.length === 0) return <Text key="self-recent" dimColor>还没有自测记录。</Text>
  return (
    <Box key="self-recent" flexDirection="column">
      <Text bold>最近记录</Text>
      {rows.map((row) => (
        <Box key={`sr-${row.id}`} flexDirection="row" gap={1}>
          <Text>{pad(labelOf(row.key), 6)}</Text>
          <Text bold>{pad(`${fmt(row.value)} ${row.unit}`, 12)}</Text>
          {row.given ? <Text dimColor>{`（原始填写 ${fmt(row.given.value)} ${row.given.unit}）`}</Text> : null}
          <Text dimColor>{dateZh(row.date, ctx.today)}</Text>
          <Button
            key={`del-${row.id}`}
            plain
            label="删除"
            dimColor
            onPress={() => {
              void ctx.act.post(`self?id=${encodeURIComponent(row.id)}`, null, { method: 'DELETE', reload: ['self', indicatorsPath('labs')], done: `已删除 ${dateZh(row.date, ctx.today)}的${labelOf(row.key)}。` })
            }}
          />
        </Box>
      ))}
    </Box>
  )
}

/** The 自测 block: latest values, the form behind 记录自测, recent entries. */
export function SelfBlock(ctx: Ctx): RenderElement {
  const { Box, Text, Button } = ctx.E
  const self = selfOf(ctx.json('journey'))
  const keys = self.keys.length > 0 ? self.keys : SELF_FALLBACK
  const open = ctx.view.sub[K('open')] === '1'
  const latest = self.latest.filter((row) => row.key !== 'dbp')
  return (
    <Box key="self-block" flexDirection="column" paddingLeft={2}>
      <Box key="self-head" flexDirection="row" gap={1}>
        <Text bold>自测</Text>
        <Text dimColor>腰围 · 家庭血压 · 体重</Text>
        <Button
          key="self-toggle"
          plain
          label={open ? '收起' : '＋ 记录自测'}
          onPress={() => {
            ctx.act.setSub(K('open'), open ? '' : '1')
            if (!open) ctx.act.load(['self'])
          }}
        />
      </Box>
      {latest.map((row) => (
        <Text key={`sl-${row.key}`} wrap="truncate-end">
          <Text dimColor>{pad(row.key === 'sbp' ? '家庭血压' : row.label_zh, 9)}</Text>
          <Text bold>{latestText(row, self.latest)}</Text>
          <Text dimColor>{`  ${row.key === 'sbp' ? `${row.n > 1 ? `7 天均值 · ${row.n} 次` : '1 次读数'} · 截至 ${dateZh(row.date, ctx.today)}` : dateZh(row.date, ctx.today)}`}</Text>
        </Text>
      ))}
      {open ? form(ctx, keys) : null}
      {open ? recent(ctx) : null}
    </Box>
  )
}
