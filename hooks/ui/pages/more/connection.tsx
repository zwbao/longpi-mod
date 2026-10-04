// 健康记录 (was 数据连接, client/connection.ts). In Claude Code the health record lives on this computer, in the
// LongPi folder: the section says what it holds and how to add to it. Reports and wearable exports go in through the
// chat: Claude reads a PDF, a photo or an export file itself and saves the values here.

import type { Ctx, Node } from '../../types.ts'
import { Buttons } from '../../kit.tsx'
import { Dot, Note } from './ui.tsx'
import type { Journey } from './types.ts'
import { day, summaryParts } from './util.ts'

export const REPORT_PROMPT = '请帮我录入这份体检报告：'
export const WEARABLE_PROMPT = '请帮我导入这份手环（手表）导出的数据：'

/** One line for the closed fold and the settings page. */
export function recordLine(journey: Journey | null): string {
  const summary = journey?.records.summary
  if (!journey) return ''
  return summary && summary.checkups + summary.wearable_days > 0 ? `存在这台电脑上 · ${summaryParts(summary).slice(0, 2).join(' · ')}` : '存在这台电脑上 · 还没有体检数据'
}

export function RecordSection(ctx: Ctx, journey: Journey, scope: string): Node[] {
  const E = ctx.E
  const summary = journey.records.summary
  const has = Boolean(summary && summary.checkups + summary.wearable_days > 0)
  const last = journey.records.latest_checkup ? `最近一次体检：${day(ctx, journey.records.latest_checkup)}` : ''
  return [
    Dot(ctx, 'on', '健康记录存在这台电脑上（~/.longpi），不上传到别处。', `${scope}-rec-dot`),
    has && summary ? Note(ctx, `找到：${summaryParts(summary).join(' · ')}`, `${scope}-rec-found`) : Note(ctx, '还没有体检数据。', `${scope}-rec-empty`),
    has && last ? Note(ctx, `${last}${journey.records.indicator_count ? ` · 共 ${journey.records.indicator_count} 项指标` : ''}`, `${scope}-rec-last`) : null,
    Note(ctx, '添加记录：把体检报告的 PDF 或照片拖进对话框（或粘贴文件路径）交给 Claude，它会读出数值，存在这台电脑上。手环、手表或血压计导出的文件也一样，交给 Claude 读进来。', `${scope}-rec-how`),
    Buttons(E, [
      { key: `${scope}-rec-report`, label: '录入一份报告', onPress: () => ctx.act.fill(REPORT_PROMPT) },
      { key: `${scope}-rec-wear`, label: '导入手环数据', onPress: () => ctx.act.fill(WEARABLE_PROMPT) },
    ], `${scope}-rec-buttons`),
  ]
}
