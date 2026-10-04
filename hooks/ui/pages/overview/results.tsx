// The results on 总览 (client/results.ts): body age and 10-year cardiovascular risk side by side, every other
// labelled method result under them, the plan's own graded sentences (这次的变化) and the share card; a blocked
// result says what it still needs and offers the one thing to do about it. The ⓘ folds hold each model's
// explanation and, when a plan has goals, what the model says if they are reached (client/goals.ts).

import type { RenderElement } from 'claude-code'

import type { MethodResult, ResultLabel } from '../../../core/contracts/library.ts'
import {
  allowsYoungerClaim, facingUnit, measuresBodyAge, olderThanAgeSentence, overviewSlice, PHENO_SKILL, primaryOutput,
  redCellDriverNames, resultSentence, RISK_SKILL, speciesOf, stripYoungerClaim, titleOf, versusCalendarAge,
} from '../../../core/core/method-view.ts'
import { projectionSentence } from '../../../core/feedback/grade.ts'
import { modelRangeNote } from '../../../core/honesty/model-range.ts'
import { pickKeyTrends } from '../../../core/ux/plain.ts'
import type { Ctx, Node } from '../../types.ts'
import { C, cells, fit, pad, padStart, bar } from '../../kit.tsx'
import { linesOf, messagesFor, shareOf, type FeedbackMessage } from './feedback.ts'
import { recordConnected, type Addon, type Journey, type ModelCard, type SelfKey, type SelfKeySpec, type Tracking } from './journey.ts'
import { nb, BandSpark, BigFigure, Para, Callout, Caption, Card, Chip, InfoButton, isOpen, Pair, setSub, Tag } from './ui.tsx'
import {
  BIOAGE_INFO, BIOAGE_LABEL, chineseDate, fmt, inPane, isCovered, minus, notableRows, NOTHING_COVERED, plainUnits, RISK_INFO, RISK_LABEL,
  riskText, UNMATCHED_ALL_ZH, unmatchedSomeZh, type Covered,
} from './words.ts'

export type ResultTarget = 'profile' | 'records' | 'addons' | 'self'

const NEEDS_SHOWN = 3

/** Where a result's action leads in the pane: the profile and record steps, or the add-on list under the results. */
export function runTarget(ctx: Ctx, target: ResultTarget): void {
  if (target === 'profile' || target === 'records') {
    setSub(ctx, 'step', target === 'profile' ? '1' : '2')
    setSub(ctx, 'onboarding', '1')
  } else {
    setSub(ctx, 'addons', '1')
  }
}

function labelText(label: ResultLabel): string {
  if (label === 'verified') return '数据已核对'
  if (label === 'unverified-binding') return '尚未核对，暂不能视为你的结果'
  return '这是研究中的结论，并非根据你的体检计算'
}

/** The tags under a result's title: 模型估计, and the label when it is not the unmatched one (said once above). */
function Tags(ctx: Ctx, mark: ResultLabel | null, estimate = true): Node {
  const { Box } = ctx.E
  const tags = [
    estimate ? Tag(ctx.E, '模型估计', 'est') : null,
    mark && mark !== 'unverified-binding' ? Tag(ctx.E, labelText(mark), 'mark', mark === 'verified' ? C.good : C.silver) : null,
  ].filter((tag): tag is RenderElement => tag !== null)
  return tags.length > 0 ? <Box key="tags" flexDirection="row" columnGap={1} flexWrap="wrap">{tags}</Box> : null
}

function shownOf(result: MethodResult): string {
  const out = primaryOutput(result)
  if (!out || out.value == null || out.value === '') return ''
  const figure = typeof out.value === 'number' ? String(Number(out.value.toFixed(2))) : String(out.value).trim()
  const unit = out.unit ? plainUnits(facingUnit(out.unit, out.key)) : ''
  return `${figure}${unit ? (unit === '%' ? '%' : ` ${unit}`) : ''}`
}

function riskFacts(facts: readonly string[]): string[] {
  return facts.filter((fact) => !/^(实足)?年龄$|^性别/.test(fact.trim()))
}

function restOfSentence(sentence: string, title: string, shown: string): string {
  let text = plainUnits(sentence)
  if (text.startsWith(`${title}是 `)) text = text.slice(title.length + 2)
  const value = plainUnits(shown)
  if (value && text.startsWith(value)) text = text.slice(value.length).trim()
  const wrapped = /^[（(]([^（）()]*(?:[（(][^（）()]*[）)][^（）()]*)*)[）)]。?(.*)$/.exec(text)
  if (wrapped) text = `${wrapped[1] ?? ''}。${wrapped[2] ?? ''}`
  return text.replace(/^[，,。\s]+/, '').trim()
}

/** An unmatched result's caption: only its source (来源：肌酐(Cr) 84 μmol/L。), or nothing. */
function bindingCaption(result: MethodResult): string {
  const out = primaryOutput(result)
  const rest = restOfSentence(resultSentence(result, { youngerAllowed: false }), titleOf(result.skill, result.title_zh, out?.key ?? ''), shownOf(result))
    .replace(/^(?:还没对上|尚未核对)[，,。]?/, '').trim()
  return rest && rest !== '。' ? rest : ''
}

function measuredOf(source: string): string {
  if (!source.startsWith('来源')) return ''
  const match = /(−?\d+(?:\.\d+)?\s*[^\s，,。；;、\d()（）]*)\s*。?$/.exec(source)
  return match?.[1]?.trim() ?? ''
}

function judgementWord(word: string): string {
  return /^[短长高低]$/.test(word) ? `偏${word}` : word
}

function bioageAction(journey: Journey): { label: string; target: ResultTarget } | null {
  const bio = journey.results.bioage
  if (bio.blocker_zh.includes('方法库')) return null
  if (journey.profile.age == null) return { label: '填写年龄', target: 'profile' }
  if (!recordConnected(journey.records.status)) return { label: '连接记录', target: 'records' }
  if (bio.missing.length > 0 || journey.addons.some((row) => row.unlocks_zh.includes('身体年龄'))) return { label: '查看加测清单', target: 'addons' }
  return null
}

function riskAction(journey: Journey): { label: string; target: ResultTarget } | null {
  const risk = journey.results.risk
  const sexKnown = journey.profile.sex === 'male' || journey.profile.sex === 'female'
  if (journey.profile.age == null || !sexKnown || risk.missing_facts.length > 0) {
    const count = Math.max(1, riskFacts(risk.missing_facts).length + (journey.profile.age == null ? 1 : 0) + (sexKnown ? 0 : 1))
    return { label: `回答 ${count} 个问题`, target: 'profile' }
  }
  if (!recordConnected(journey.records.status)) return { label: '连接记录', target: 'records' }
  if (risk.missing_labs.length > 0) return { label: '查看加测清单', target: 'addons' }
  return null
}

function riskSelfAddon(journey: Journey): Addon | undefined {
  return journey.addons.find((row) => row.self_measurable && row.self_key && row.unlocks_zh.includes('心血管'))
}

// --- measuring at home (self-measure.ts InlineSelf) -------------------------------------------------

const SELF_FALLBACK: SelfKeySpec[] = [
  { key: 'waist', label_zh: '腰围', unit: 'cm', units: ['cm'] },
  { key: 'sbp', label_zh: '收缩压', unit: 'mmHg', units: ['mmHg'] },
  { key: 'dbp', label_zh: '舒张压', unit: 'mmHg', units: ['mmHg'] },
  { key: 'weight', label_zh: '体重', unit: 'kg', units: ['kg'] },
]

function specOf(journey: Journey, key: SelfKey): SelfKeySpec {
  return journey.self.keys.find((row) => row.key === key) ?? SELF_FALLBACK.find((row) => row.key === key) as SelfKeySpec
}

function numberOf(text: string): number | null {
  const trimmed = text.trim().replace(/，/g, '.').replace(/,/g, '.')
  if (!trimmed) return null
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : Number.NaN
}

async function saveSelf(ctx: Ctx, entries: Array<{ key: SelfKey; value: number; unit: string }>, done: string): Promise<void> {
  const answer = await ctx.act.post('self', { entries }, { reload: ['tracking'], quiet: true })
  const problems = Array.isArray(answer.json.problems) ? (answer.json.problems as unknown[]).filter((row): row is string => typeof row === 'string') : []
  if (!answer.ok) ctx.act.toast(typeof answer.json.error === 'string' ? answer.json.error : '记录失败，请稍后再试。')
  else ctx.act.toast(problems.length > 0 ? problems.join(' ') : done)
}

/** One field for a measurement taken at home: waist (a unit may follow the number: 2.6尺) or blood pressure (135/85). */
export function SelfEntry(ctx: Ctx, journey: Journey, key: SelfKey, idPrefix: string): Node {
  if (!('Input' in ctx.E)) return null
  const { Input } = ctx.E as unknown as { Input: (props: Record<string, unknown>) => RenderElement }
  const bp = key === 'sbp' || key === 'dbp'
  const spec = specOf(journey, key)
  const submit = (raw: string) => {
    const text = raw.trim()
    if (bp) {
      const match = /^(\d+(?:\.\d+)?)\s*[/／\s]\s*(\d+(?:\.\d+)?)\s*(?:mmhg)?$/i.exec(text)
      if (!match) return ctx.act.toast('请填写收缩压和舒张压，例如 135/85。')
      void saveSelf(ctx, [{ key: 'sbp', value: Number(match[1]), unit: 'mmHg' }, { key: 'dbp', value: Number(match[2]), unit: 'mmHg' }], '已记录血压，正在重新计算。')
      return undefined
    }
    const match = /^(\d+(?:[.,，]\d+)?)\s*(.*)$/.exec(text)
    const value = match ? numberOf(match[1] ?? '') : null
    if (value == null || Number.isNaN(value)) return ctx.act.toast(`${spec.label_zh}请填写数字。`)
    const said = (match?.[2] ?? '').trim()
    const unit = said ? spec.units.find((row) => row.toLowerCase() === said.toLowerCase()) : spec.unit
    if (!unit) return ctx.act.toast(`${spec.label_zh}的单位可写 ${spec.units.slice(0, 4).join('、')}。`)
    void saveSelf(ctx, [{ key, value, unit }], `已记录${spec.label_zh}，正在重新计算。`)
    return undefined
  }
  return Input({
    key: `self-${idPrefix}-${key}`,
    label: bp ? '血压' : spec.label_zh,
    placeholder: bp ? '收缩压/舒张压，例如 135/85' : `例如 86（${spec.unit}，也可写 2.6尺）`,
    submitLabel: '记录',
    onSubmit: (value: string) => { submit(value) },
  })
}

// --- a blocked result ----------------------------------------------------------------------------

function Blocked(ctx: Ctx, props: {
  journey: Journey; key: string; label: string; info: string[]; infoKey: string; blocker: string; questions: string[]; labs: string[]
  action: { label: string; target: ResultTarget } | null; selfAddon?: Addon; idPrefix: string; note?: string | null; width: number
}): RenderElement {
  const { Box, Text, Button } = ctx.E
  const inner = props.width - 4
  const action = props.action
  const self = props.selfAddon && props.selfAddon.self_key && action?.target !== 'profile' && action?.target !== 'records' ? props.selfAddon : null
  const all = [...props.questions, ...props.labs]
  const count = [props.questions.length > 0 ? `${props.questions.length} 个问题` : '', props.labs.length > 0 ? `${props.labs.length} 项指标` : ''].filter(Boolean).join('、')
  const needs = all.length > 0
    ? (
      <Box key="needs" flexDirection="row" columnGap={1} flexWrap="wrap">
        <Text key="c" dimColor>{`还差 ${count}`}</Text>
        {all.slice(0, NEEDS_SHOWN).map((need) => Tag(ctx.E, fit(need, Math.max(8, inner - 14)), `n-${need}`))}
        {all.length > NEEDS_SHOWN ? <Text key="more" dimColor>…</Text> : null}
      </Box>
    )
    : <Text key="needs" wrap="wrap">{nb(props.blocker ? `还缺：${inPane(props.blocker).replace(/^记录里还缺|^档案里还缺|^还缺/, '').replace(/^[：:]/, '')}` : '缺少计算所需的数据。')}</Text>
  return Card(ctx, {
    key: props.key, title: props.label, width: props.width, aside: InfoButton(ctx, props.infoKey),
    children: [
      Tags(ctx, null),
      isOpen(ctx, props.infoKey) ? <Box key="info" flexDirection="column">{props.info.map((line, i) => Caption(ctx.E, line, `i${i}`, inner))}</Box> : null,
      <Text key="wait" bold dimColor>暂时无法计算</Text>,
      needs,
      props.note ? Caption(ctx.E, props.note, 'note', inner) : null,
      self?.self_key
        ? (
          <Box key="self" flexDirection="column" marginTop={1}>
            {Caption(ctx.E, `${self.item_zh}可在家自行测量，记录后即可计算：`, 'cap', inner)}
            {SelfEntry(ctx, props.journey, self.self_key, props.idPrefix)}
          </Box>
        )
        : action ? <Box key="act" marginTop={1}><Button key={`act-${props.idPrefix}`} label={action.label} onPress={() => runTarget(ctx, action.target)} /></Box> : null,
    ],
  })
}

// --- what the models say if the goals are reached (goals.ts) -----------------------------------------

/** goals.ts LeverBars in cells: label, a bar to the largest, the value, the detail. */
function LeverRows(ctx: Ctx, rows: Array<{ label: string; detail: string; value: number; unit: string }>, width: number, key: string): RenderElement {
  const { Box, Text } = ctx.E
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 0.0001)
  const labelW = Math.min(14, Math.max(...rows.map((row) => cells(row.label))))
  const barW = Math.max(4, Math.min(12, width - labelW - 16))
  return (
    <Box key={key} flexDirection="column">
      {rows.map((row, i) => (
        <Box key={`r${i}`} flexDirection="column">
          <Text key="l">
            <Text key="a">{pad(row.label, labelW)} </Text>
            <Text key="b" color={row.value < 0 ? C.good : C.warn}>{bar(Math.abs(row.value) / max, barW)}</Text>
            <Text key="c" bold>{` ${padStart(`${fmt(row.value, 1)}`, 5)} ${row.unit}`}</Text>
          </Text>
          {row.detail ? <Text key="d" dimColor>{`${' '.repeat(labelW + 1)}${fit(row.detail, Math.max(8, width - labelW - 1))}`}</Text> : null}
        </Box>
      ))}
    </Box>
  )
}

function PhenoGoal(ctx: Ctx, pheno: ModelCard | undefined, width: number, today: string): Node {
  if (!pheno) return null
  const { Box, Text } = ctx.E
  const goal = pheno.goal
  const now = pheno.now?.phenoage
  const levers = (pheno.levers ?? []).map((row) => ({ label: row.label, detail: plainUnits(`${row.from} → ${row.to}`), value: row.years, unit: '岁' }))
  const sens = (pheno.sensitivity ?? []).map((row) => ({ label: row.label, detail: plainUnits(`一次真实变化约 ${row.step}`), value: -Math.abs(row.years_per_step), unit: '岁' }))
  return (
    <Box key="goal" flexDirection="column" marginTop={1}>
      <Text key="h" bold>如果达到目标</Text>
      {goal
        ? (
          <Text key="fig">
            <Text key="a" dimColor>现在 </Text><Text key="b" bold>{`${fmt(now)} 岁`}</Text>
            <Text key="c" dimColor>{' → 达到方案目标 '}</Text><Text key="d" bold color={C.good}>{`${fmt(goal.phenoage)} 岁`}</Text>
            <Text key="e">{' '}</Text>{Chip(ctx.E, `${fmt(goal.phenoage_delta)} 岁`, 'good', 'delta')}
          </Text>
        )
        : pheno.note_zh ? Caption(ctx.E, pheno.note_zh, 'note', width) : null}
      {levers.length > 0
        ? <Box key="lv" flexDirection="column"><Text key="s" dimColor>每个目标单独的贡献</Text>{LeverRows(ctx, levers, width, 'lr')}</Box>
        : sens.length > 0 ? <Box key="sv" flexDirection="column"><Text key="s" dimColor>对你的身体年龄影响最大的指标</Text>{LeverRows(ctx, sens.slice(0, 4), width, 'sr')}</Box> : null}
      {(pheno.levers ?? []).slice(0, 3).map((row, i) => Caption(ctx.E, minus(projectionSentence(row.label, row.to, row.years, row.from)), `p${i}`, width))}
      {goal && goal.phenoage_delta != null ? Caption(ctx.E, minus(projectionSentence('达到方案目标时的身体年龄', `${fmt(goal.phenoage)} 岁`, goal.phenoage_delta, now != null ? `${fmt(now)} 岁` : undefined)), 'pg') : null}
      {Caption(ctx.E, `${pheno.measured_on ? `按 ${chineseDate(pheno.measured_on, today) || pheno.measured_on}的血检计算。` : ''}${pheno.boundary_zh ?? ''}`, 'mb')}
    </Box>
  )
}

function RiskGoal(ctx: Ctx, risk: ModelCard | undefined, width: number): Node {
  if (!risk) return null
  const { Box, Text } = ctx.E
  const pct = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(1)}%`
  const missing = risk.missing ?? []
  return (
    <Box key="goal" flexDirection="column" marginTop={1}>
      <Text key="h" bold>如果达到目标</Text>
      {risk.status === 'unavailable'
        ? missing.length > 0
          ? <Text key="miss" wrap="wrap">{nb(`还差 ${missing.length} 项：${missing.slice(0, 3).join('、')}${missing.length > 3 ? ` 等 ${missing.length} 项` : ''}`)}</Text>
          : <Text key="miss" wrap="wrap">{nb(`暂不显示${risk.note_zh ? `。${risk.note_zh}` : ''}`)}</Text>
        : (
          <Box key="fig" flexDirection="column">
            <Text key="f">
              <Text key="a" dimColor>现在 </Text><Text key="b" bold>{pct(risk.now?.risk_pct)}</Text>
              {risk.category_zh?.now ? <Text key="c" dimColor>{`（${risk.category_zh.now}）`}</Text> : null}
              {risk.goal ? <Text key="d" dimColor>{' → 达到方案目标 '}</Text> : null}
              {risk.goal ? <Text key="e" bold color={C.good}>{pct(risk.goal.risk_pct)}</Text> : null}
              {risk.goal && risk.category_zh?.goal ? <Text key="g" color={C.good}>{`（${risk.category_zh.goal}）`}</Text> : null}
            </Text>
            {(risk.levers ?? []).length > 0
              ? <Box key="lv" flexDirection="column"><Text key="s" dimColor>每个目标单独的贡献</Text>{LeverRows(ctx, (risk.levers ?? []).map((row) => ({ label: row.label, detail: `${row.from} → ${row.to}`, value: row.years, unit: '个百分点' })), width, 'lr')}</Box>
              : risk.note_zh ? Caption(ctx.E, risk.note_zh, 'note', width) : null}
          </Box>
        )}
      {risk.boundary_zh ? Caption(ctx.E, risk.boundary_zh, 'b', width) : null}
    </Box>
  )
}

// --- body age ------------------------------------------------------------------------------------------

function KeyTrends(ctx: Ctx, journey: Journey, older: boolean, covered: Covered, width: number): Node {
  const { Box, Text } = ctx.E
  const below = new Set(notableRows(journey.changes, covered).map((row) => row.key))
  const trends = pickKeyTrends(journey.changes.filter((row) => !isCovered(covered, row) && !below.has(row.key)), older)
  if (trends.length === 0) return null
  return (
    <Box key="trends" flexDirection="column" marginTop={1}>
      <Text key="h" dimColor>相关变化</Text>
      {trends.map((row) => (
        <Text key={`t-${row.label_zh}`} wrap="wrap">
          <Text key="a" bold>{nb(row.label_zh)}</Text>
          <Text key="b" dimColor>{nb(` ${fit(plainUnits(row.text_zh.startsWith(row.label_zh) ? row.text_zh.slice(row.label_zh.length).trim() : row.text_zh), Math.max(10, width * 2))}`)}</Text>
        </Text>
      ))}
    </Box>
  )
}

export function BodyAgeCard(ctx: Ctx, props: { journey: Journey; tracking: Tracking | null; messages: FeedbackMessage[]; method?: MethodResult; covered: Covered; width: number }): RenderElement {
  const { Box, Text } = ctx.E
  const { journey, tracking, method } = props
  const today = journey.today || ctx.today
  const result = journey.results.bioage
  const inner = props.width - 4
  if (result.status !== 'ok') {
    return Blocked(ctx, {
      journey, key: 'bio', label: BIOAGE_LABEL, info: [BIOAGE_INFO], infoKey: 'info.bio', blocker: result.blocker_zh,
      questions: journey.profile.age == null ? ['年龄'] : [], labs: result.missing, action: bioageAction(journey), idPrefix: 'bio', width: props.width,
    })
  }
  const bio = tracking?.bioage
  const points = (bio?.points ?? []).filter((row) => Number.isFinite(row.phenoage))
  const latest = points.at(-1)
  const first = points[0]
  const phenoage = latest?.phenoage ?? result.phenoage
  const band = bio?.band_years ?? result.band_years
  const date = latest?.date ?? result.date
  const count = points.length || result.checkups
  const partial = (bio?.band_missing ?? []).length > 0
  const graded = props.messages.find((row) => row.subject.kind === 'bioage')
  const verified = !method || method.label === 'verified'
  const concernLine = /不一定是好事/.test(result.headline_zh ?? '') || /不一定是好事/.test(graded?.headline_zh ?? '')
  const younger = !concernLine && verified && allowsYoungerClaim('verified', graded?.allowed_claims)
  const drivers = redCellDriverNames(journey.changes)
  const advanceNow = latest?.advance ?? result.advance
  const older = phenoage != null && advanceNow != null ? olderThanAgeSentence({ phenoage, advance: advanceNow, drivers }) : null
  const binding = method && method.label === 'unverified-binding' ? bindingCaption(method) : ''
  const gradedText = concernLine
    ? (result.headline_zh || graded?.headline_zh || '')
    : graded ? (younger ? graded.headline_zh : stripYoungerClaim(graded.headline_zh)) : ''
  const caption = older
    ? [older, younger && graded ? graded.headline_zh : '', binding].filter(Boolean).join('')
    : [binding, gradedText].filter(Boolean).join('')
  const unmatched = method?.label === 'unverified-binding'
  const trend = points.filter((row) => row.advance != null)
  const bandRange = band != null && first?.advance != null ? { lo: first.advance - band, hi: first.advance + band } : null
  const info = [
    BIOAGE_INFO,
    band != null ? `正常波动范围：首次检查 ±${fmt(band)} 岁${partial ? `（未含${bio?.band_missing?.join('、')}）` : ''}。${trend.length > 1 ? '趋势线里灰色的点在范围内，彩色的点落在范围外，才视为真实变化。' : '落在范围外才视为真实变化。'}` : '',
    date ? `最近一次：${chineseDate(date, today)}体检，共 ${count} 次完整血检。` : '',
  ].filter(Boolean)
  return Card(ctx, {
    key: 'bio', title: BIOAGE_LABEL, width: props.width, aside: InfoButton(ctx, 'info.bio'),
    children: [
      Tags(ctx, method?.label ?? null),
      isOpen(ctx, 'info.bio')
        ? <Box key="info" flexDirection="column">{info.map((line, i) => Caption(ctx.E, line, `i${i}`, inner))}{PhenoGoal(ctx, tracking?.models?.find((row) => row.model === 'phenoage'), inner, today)}</Box>
        : null,
      BigFigure(ctx.E, { key: 'fig', value: plainUnits(fmt(phenoage)), unit: '岁', color: unmatched ? C.silver : C.accent, width: inner, after: [younger ? Chip(ctx.E, '真实变化', 'good', 'real') : null] }),
      !older && versusCalendarAge(result.advance) ? Caption(ctx.E, versusCalendarAge(result.advance), 'gap', inner) : null,
      result.caveat_zh && !concernLine ? Callout(ctx.E, plainUnits(result.caveat_zh), 'warn', 'caveat', inner) : null,
      trend.length > 1
        ? (
          <Box key="trend" flexDirection="column">
            <Text key="t">
              <Text key="l" dimColor>身体年龄减周岁 </Text>
              {BandSpark(ctx.E, trend.map((row) => row.advance as number), Math.min(24, inner - 30), bandRange, (v) => (bandRange && v < bandRange.lo ? C.good : C.warn), 'sp')}
              <Text key="r">{` ${fmt(trend[0]?.advance)} → ${fmt(trend.at(-1)?.advance)} 岁`}</Text>
            </Text>
            <Text key="d" dimColor>{`${chineseDate(trend[0]?.date, today)} → ${chineseDate(trend.at(-1)?.date, today)}${bandRange ? ` · 0 为与周岁持平` : ''}`}</Text>
          </Box>
        )
        : tracking == null ? <Text key="trend" dimColor>…</Text> : null,
      caption ? Para(ctx.E, plainUnits(caption), inner, { key: 'cap', ...(younger ? { color: C.good } : { dim: true }) }) : null,
      KeyTrends(ctx, journey, (advanceNow ?? 0) > 0, props.covered, inner),
      <Text key="fine" dimColor>{[count > 0 ? `${count} 次体检` : '', trend.length > 1 && band != null ? '灰色为正常波动范围内' : ''].filter(Boolean).join(' · ')}</Text>,
    ],
  })
}

// --- 10-year risk ----------------------------------------------------------------------------------------

/** The library run the risk card shows: an unmatched run only when it gives the card's own number. */
function riskCardMethod(journey: Journey, method?: MethodResult): MethodResult | undefined {
  const risk = journey.results.risk
  const out = method ? primaryOutput(method) : null
  const same = out != null && typeof out.value === 'number' && risk.risk_pct != null && Math.abs(out.value - risk.risk_pct) < 0.05
  return method && (method.label !== 'unverified-binding' || same) ? method : undefined
}

export function RiskCard(ctx: Ctx, props: { journey: Journey; tracking: Tracking | null; method?: MethodResult; width: number }): RenderElement {
  const { Box, Text } = ctx.E
  const { journey, tracking } = props
  const today = journey.today || ctx.today
  const result = journey.results.risk
  const range = modelRangeNote('china-par', journey.profile.age)
  const card = tracking?.models?.find((row) => row.model === 'china-par')
  if (result.status !== 'ok') {
    const profile = journey.profile
    const questions = [...(profile.age == null ? ['年龄'] : []), ...(profile.sex !== 'male' && profile.sex !== 'female' ? ['性别'] : []), ...riskFacts(result.missing_facts)]
    return Blocked(ctx, {
      journey, key: 'risk', label: RISK_LABEL, info: [RISK_INFO], infoKey: 'info.risk', blocker: result.blocker_zh, questions, labs: result.missing_labs, note: range,
      action: riskAction(journey), selfAddon: riskSelfAddon(journey), idPrefix: 'risk', width: props.width,
    })
  }
  const goal = card?.goal?.risk_pct
  const method = riskCardMethod(journey, props.method)
  const binding = method && method.label === 'unverified-binding' ? bindingCaption(method) : ''
  const info = [RISK_INFO, card?.note_zh ?? ''].filter(Boolean)
  return Card(ctx, {
    key: 'risk', title: RISK_LABEL, width: props.width, aside: InfoButton(ctx, 'info.risk'),
    children: [
      Tags(ctx, method?.label ?? null),
      isOpen(ctx, 'info.risk')
        ? <Box key="info" flexDirection="column">{info.map((line, i) => Caption(ctx.E, line, `i${i}`, props.width - 4))}{RiskGoal(ctx, card, props.width - 4)}</Box>
        : null,
      BigFigure(ctx.E, { key: 'fig', value: riskText(result.risk_pct), unit: '%', color: C.accent, width: props.width - 4, after: [result.category_zh ? Chip(ctx.E, result.category_zh, 'neutral', 'cat') : null] }),
      range ? Caption(ctx.E, range, 'range', props.width - 4) : null,
      goal != null && Number.isFinite(goal)
        ? (
          <Box key="goal" flexDirection="row" gap={1}>
            <Text key="a" dimColor>达到方案目标约</Text>
            <Text key="b" bold>{`${riskText(goal)}%`}</Text>
            {card?.category_zh?.goal ? Chip(ctx.E, card.category_zh.goal, 'good', 'gc') : null}
          </Box>
        )
        : null,
      binding ? Caption(ctx.E, binding, 'bind', props.width - 4) : null,
      Caption(ctx.E, [result.date ? `按 ${chineseDate(result.date, today)}的记录和你的档案计算` : '', '未来 10 年发生心梗、脑卒中等的估计概率'].filter(Boolean).join(' · '), 'note', props.width - 4),
    ],
  })
}

// --- every other result ----------------------------------------------------------------------------

function MethodRow(ctx: Ctx, result: MethodResult, width: number, index: number): RenderElement {
  const { Box, Text } = ctx.E
  const out = primaryOutput(result)
  const numeric = out != null && typeof out.value === 'number'
  const title = titleOf(result.skill, result.title_zh, out?.key ?? '')
  const figure = numeric ? String(Number((out.value as number).toFixed(2))) : out && typeof out.value === 'string' ? out.value.trim() : ''
  const unit = out?.unit ? plainUnits(facingUnit(out.unit, out.key)) : ''
  const unmatched = result.label === 'unverified-binding'
  const sentence = unmatched ? bindingCaption(result)
    : figure ? restOfSentence(resultSentence(result, { youngerAllowed: false }), title, shownOf(result))
      : plainUnits(resultSentence(result, { youngerAllowed: false }))
  const shown = numeric
    ? `${plainUnits(figure)}${unit ? (unit === '%' ? '%' : ` ${unit}`) : ''}`
    : figure ? [unmatched ? measuredOf(sentence) : '', judgementWord(plainUnits(figure))].filter(Boolean).join(' · ') : ''
  const figW = Math.min(22, Math.max(6, cells(shown)))
  return (
    <Box key={`m${index}`} flexDirection="column" marginTop={index > 0 ? 1 : 0}>
      <Box key="h" flexDirection="row" justifyContent="space-between">
        <Text key="t" bold>{fit(title, Math.max(8, width - figW - 2))}</Text>
        <Text key="f" bold={!unmatched && numeric} color={unmatched ? undefined : C.accent}>{fit(shown, figW)}</Text>
      </Box>
      {result.label !== 'unverified-binding' ? <Text key="l" color={result.label === 'verified' ? C.good : C.silver}>{`[模型估计] [${labelText(result.label)}]`}</Text> : null}
      {sentence ? Para(ctx.E, sentence, width, { key: 's', dim: true }) : null}
    </Box>
  )
}

function EvidenceRow(ctx: Ctx, result: MethodResult, index: number): RenderElement {
  const { Box, Text } = ctx.E
  return (
    <Box key={`e${index}`} flexDirection="column" marginTop={index > 0 ? 1 : 0}>
      <Text key="s" bold>{`物种：${speciesOf(result) ?? '未标明'}`}</Text>
      <Text key="t" wrap="wrap">{nb(plainUnits(resultSentence(result, { youngerAllowed: false })))}</Text>
      {result.limits_zh ? <Text key="l" dimColor wrap="wrap">{nb(result.limits_zh)}</Text> : null}
    </Box>
  )
}

// --- 这次的变化 and the share card (feedback/) --------------------------------------------------------

function FeedbackBlock(ctx: Ctx, journey: Journey, messages: FeedbackMessage[], width: number): Node[] {
  const { Box, Text, Button } = ctx.E
  const today = journey.today || ctx.today
  const summary = messages.find((row) => row.id === 'fb-summary')
  const behaviour = messages.find((row) => row.grade === 'behaviour_done')
  const projection = messages.find((row) => row.grade === 'projection')
  const share = shareOf(messages)
  const shown = [summary, behaviour, projection].filter((row): row is FeedbackMessage => row != null)
  const out: Node[] = []
  if (shown.length > 0) {
    out.push(Card(ctx, {
      key: 'feedback', title: '这次的变化', width,
      children: shown.map((row, i) => (
        <Box key={`fb${i}`} flexDirection="column" marginTop={i > 0 ? 1 : 0}>
          {linesOf(row, today).map((line, j) => (
            Para(ctx.E, line, width - 4, { key: `l${j}`, ...(j > 0 ? { dim: true } : {}), ...(j === 0 && (row.tone === 'celebrate' || row.tone === 'encourage') ? { color: C.good } : {}), ...(j === 0 && row.tone === 'celebrate' ? { bold: true } : {}) })
          ))}
        </Box>
      )),
    }))
  }
  if (share) {
    const compact = messages.some((row) => row.subject.kind === 'bioage' && row.headline_zh === share.card.headline_zh)
    out.push(Card(ctx, {
      key: 'share', title: share.card.title_zh, width, tone: C.good,
      children: [
        compact ? Caption(ctx.E, '上面身体年龄卡里的那句话，可以复制下来发给家人或朋友。', 'c', width - 4) : Para(ctx.E, share.card.headline_zh, width - 4, { key: 'h', bold: true, color: C.good }),
        ...(compact ? [] : share.card.lines_zh.map((line, i) => Caption(ctx.E, line, `l${i}`, width - 4))),
        !compact && share.card.footnote_zh ? Caption(ctx.E, share.card.footnote_zh, 'f', width - 4) : null,
        <Box key="a" marginTop={1}><Button key="copy-share" label="复制这句话" onPress={() => ctx.act.copy(share.text)} /></Box>,
      ],
    }))
  }
  return out
}

// --- the next-checkup add-on list (AddonList) ----------------------------------------------------------

export function AddonList(ctx: Ctx, journey: Journey, idPrefix: string, width: number): RenderElement {
  const { Box, Text } = ctx.E
  if (journey.addons.length === 0) return <Text key="addons" dimColor>没有需要加测的项目。</Text>
  // Blood pressure is one field for both numbers: the diastolic row would repeat it.
  const rows = journey.addons.filter((row) => row.self_key !== 'dbp')
  const nameW = Math.min(18, Math.max(...rows.map((row) => cells(row.item_zh))))
  return (
    <Box key="addons" flexDirection="column">
      {rows.map((row, i) => (
        <Box key={`a${i}`} flexDirection="column">
          <Text key="t">
            <Text key="i" color={row.self_measurable ? C.teal : C.silver}>{row.self_measurable ? '◆ ' : '◇ '}</Text>
            <Text key="n" bold>{pad(row.item_zh, nameW)}</Text>
            <Text key="u" dimColor>{fit(`  解锁：${row.unlocks_zh}${row.self_measurable ? ' · 可在家自行测量' : ' · 下次体检加测'}`, Math.max(10, width - nameW - 2))}</Text>
          </Text>
          {row.self_measurable && row.self_key ? <Box key="in" paddingLeft={2}>{SelfEntry(ctx, journey, row.self_key, `${idPrefix}-${i}`)}</Box> : null}
        </Box>
      ))}
    </Box>
  )
}

// --- the row of results ------------------------------------------------------------------------------

export function ResultsRow(ctx: Ctx, props: { journey: Journey; tracking: Tracking | null; covered: Covered }): Node[] {
  const { Button } = ctx.E
  const { journey, tracking } = props
  const width = ctx.width
  const focus = journey.profile.focus
  const riskAt = focus.findIndex((key) => key === 'cardio' || key === 'weight')
  const bioAt = focus.indexOf('bioage')
  const riskFirst = riskAt >= 0 && (bioAt < 0 || riskAt < bioAt)
  const methods = journey.method_results
  const bodyRows = methods.filter((row) => measuresBodyAge(row))
  const pheno = methods.find((row) => row.skill === PHENO_SKILL && row.label !== 'evidence-only')
    ?? bodyRows.find((row) => row.label === 'verified') ?? bodyRows[0]
  const riskMethod = methods.find((row) => row.skill === RISK_SKILL && row.label !== 'evidence-only')
  const hide = new Set<string>()
  if (journey.results.bioage.status === 'ok') hide.add(PHENO_SKILL)
  if (journey.results.risk.status === 'ok') hide.add(RISK_SKILL)
  const slice = overviewSlice(methods)
  const extras = slice.value.filter((row) => !hide.has(row.skill) && !(journey.results.bioage.status === 'ok' && measuresBodyAge(row)))
  const messages = messagesFor(journey, tracking, { recordChanges: false })
  const bio = (w: number) => BodyAgeCard(ctx, { journey, tracking, messages, method: pheno, covered: props.covered, width: w })
  const risk = (w: number) => RiskCard(ctx, { journey, tracking, method: riskMethod, width: w })
  const shownMethods = [
    journey.results.bioage.status === 'ok' ? pheno : undefined,
    journey.results.risk.status === 'ok' ? riskCardMethod(journey, riskMethod) : undefined,
    ...extras,
  ]
  const unmatchedCount = shownMethods.filter((row) => row?.label === 'unverified-binding').length
  const out: Node[] = []
  if (unmatchedCount > 0) {
    out.push(Caption(ctx.E, unmatchedCount === shownMethods.filter(Boolean).length ? UNMATCHED_ALL_ZH : unmatchedSomeZh(unmatchedCount), 'unmatched', width))
  }
  out.push(Pair(ctx, 'results', riskFirst ? risk : bio, riskFirst ? bio : risk))
  if (extras.length > 0) {
    out.push(Card(ctx, { key: 'methods', title: '其他结果', width, note: `${extras.length} 项`, children: extras.map((row, i) => MethodRow(ctx, row, width - 4, i)) }))
  }
  if (slice.evidence.length > 0) {
    const open = isOpen(ctx, 'evidence')
    out.push(Card(ctx, {
      key: 'evidence', title: '文献证据', width, note: `${slice.evidence.length} 条 · 研究中的结论，并非根据你的体检计算`,
      aside: <Button key="ev-fold" plain dimColor label={open ? '收起' : '展开'} onPress={() => setSub(ctx, 'evidence', open ? '' : '1')} />,
      children: open ? slice.evidence.map((row, i) => EvidenceRow(ctx, row, i)) : [],
    }))
  }
  if (isOpen(ctx, 'addons')) {
    out.push(Card(ctx, {
      key: 'addons-card', title: '下次体检加测', width, tone: C.accent,
      aside: <Button key="addons-close" plain dimColor label="收起" onPress={() => setSub(ctx, 'addons', '')} />,
      children: [AddonList(ctx, journey, 'ov', width - 4)],
    }))
  }
  out.push(...FeedbackBlock(ctx, journey, messages, width))
  return out
}
