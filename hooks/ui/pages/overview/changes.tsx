// 值得注意的变化 on 总览 (client/changes.ts): record changes beyond normal fluctuation, at most three rows (a
// doctor's first), the advice said once per group, each row's trend with the points outside the band in colour,
// and 判断依据 folded. The server decides which rows qualify and writes every sentence; nothing here names a cause.

import type { RenderElement } from 'claude-code'

import { sourceLabel } from '../../../core/ux/plain.ts'
import type { Ctx, Node } from '../../types.ts'
import { C, cells, fit, pad } from '../../kit.tsx'
import type { Journey, RecordChange } from './journey.ts'
import { nb, BandSpark, Callout, Caption, Card, Chip, FoldButton, isOpen, type Tone } from './ui.tsx'
import { BASIS_ZH, isCovered, notableRows, NOTHING_COVERED, pairText, plainUnits, type Covered } from './words.ts'

const VERDICT_ZH: Record<RecordChange['verdict'], string> = { better: '变好', worse: '变差', unclear: '需结合参考范围' }

function toneOf(row: RecordChange): 'warn' | 'good' | 'neutral' {
  return row.ask_doctor ? 'warn' : row.verdict === 'better' ? 'good' : 'neutral'
}

/** The verdict as a coloured chip: 变好 green, 变差 (or one for the doctor) amber, the rest grey. */
export function ChangeChip(ctx: Ctx, verdict: RecordChange['verdict'], askDoctor: boolean, key = 'chip'): RenderElement {
  const tone: Tone = verdict === 'better' && !askDoctor ? 'good' : verdict === 'worse' || askDoctor ? 'warn' : 'neutral'
  return Chip(ctx.E, VERDICT_ZH[verdict], tone, key)
}

function groupsOf(rows: readonly RecordChange[]): Array<{ advice: string; tone: string; rows: RecordChange[] }> {
  const groups: Array<{ advice: string; tone: string; rows: RecordChange[] }> = []
  for (const row of rows) {
    const found = groups.find((group) => group.advice === row.advice_zh && group.tone === toneOf(row))
    if (found) found.rows.push(row)
    else groups.push({ advice: row.advice_zh, tone: toneOf(row), rows: [row] })
  }
  return groups
}

function NotableRow(ctx: Ctx, row: RecordChange, width: number, labelW: number): RenderElement {
  const { Box, Text } = ctx.E
  const values = plainUnits(row.compare.from === row.compare.to ? `${row.compare.to} ${row.unit}`.trim() : `${pairText(row.compare.from, row.compare.to)} ${row.unit}`.trim())
  const base = row.compare.from
  const band = row.compare.from_date !== '' ? { lo: base * (1 + row.band_pct.down / 100), hi: base * (1 + row.band_pct.up / 100) } : null
  const outColor = row.verdict === 'better' && !row.ask_doctor ? C.good : row.verdict === 'worse' || row.ask_doctor ? C.warn : C.accent
  const chipW = cells(VERDICT_ZH[row.verdict]) + 2
  return (
    <Box key={`row-${row.key}`} flexDirection="row" gap={1}>
      {ChangeChip(ctx, row.verdict, row.ask_doctor, 'chip')}
      <Text key="l" bold>{pad(row.label_zh, Math.min(labelW, Math.max(6, width - chipW - 24)))}</Text>
      <Text key="v">{fit(values, Math.max(8, width - chipW - labelW - 14))}</Text>
      {row.points.length >= 2 ? BandSpark(ctx.E, row.points.map((p) => p.value), 8, band, () => outColor, 'sp') : null}
    </Box>
  )
}

/** 判断依据: one plain sentence and where the fluctuation data comes from. */
function Basis(ctx: Ctx, journey: Journey, rows: readonly RecordChange[]): Node {
  const { Box, Text } = ctx.E
  const unjudged = journey.changes_unjudged
  if (rows.length === 0 && unjudged.length === 0) return null
  const seen = new Set<string>()
  const sources = rows.map((row) => row.source).filter((source) => {
    const key = source.url || source.title
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return (
    <Box key="basis" flexDirection="column" marginTop={1}>
      {FoldButton(ctx, 'basis', '判断依据')}
      {isOpen(ctx, 'basis')
        ? (
          <Box key="body" flexDirection="column" paddingLeft={2}>
            {Caption(ctx.E, BASIS_ZH, 'b', ctx.width - 6)}
            {unjudged.length > 0 ? Caption(ctx.E, `以下指标本次未完整读取，暂不判断：${unjudged.map((row) => row.label_zh).join('、')}。`, 'u', ctx.width - 6) : null}
            {sources.length > 0 ? <Text key="s" dimColor wrap="wrap">{nb(`数据来源：${sources.map((source) => sourceLabel(source.title)).join('；')}`)}</Text> : null}
          </Box>
        )
        : null}
    </Box>
  )
}

export function NotableChanges(ctx: Ctx, journey: Journey, covered: Covered = NOTHING_COVERED): Node {
  const { Box, Button } = ctx.E
  const rows = journey.changes
  if (rows.length === 0 && journey.changes_unjudged.length === 0) return null
  const onCard = rows.filter((row) => isCovered(covered, row))
  const shown = notableRows(rows, covered)
  const advice = groupsOf(shown).filter((group) => group.advice && group.tone === 'warn')
  const pointer = onCard.length > 0
    ? `${onCard[0]?.label_zh ?? ''}${onCard.length > 1 ? `等 ${onCard.length} 项` : ''}的变化，即上方「最重要的一步」所指的情况。`
    : ''
  const inner = ctx.width - 4
  const labelW = Math.min(16, Math.max(6, ...shown.map((row) => cells(row.label_zh))))
  return Card(ctx, {
    key: 'changes', title: '值得注意的变化', width: ctx.width, note: rows.length > 0 ? `${rows.length} 项超出正常波动` : '',
    aside: <Button key="changes-all" plain dimColor label="在「化验」中查看全部 →" onPress={() => ctx.act.go('labs', { 'labs.filter': 'changed' })} />,
    children: [
      pointer ? Caption(ctx.E, pointer, 'pointer', inner) : null,
      ...advice.map((group, i) => Callout(ctx.E, group.advice, 'warn', `adv${i}`, inner)),
      shown.length > 0
        ? <Box key="rows" flexDirection="column" marginTop={advice.length > 0 ? 1 : 0}>{shown.map((row) => NotableRow(ctx, row, inner, labelW))}</Box>
        : pointer ? null : Caption(ctx.E, '没有超出正常波动的变化。', 'none'),
      Basis(ctx, journey, rows),
    ],
  })
}
