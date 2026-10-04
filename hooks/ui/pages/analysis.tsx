// The 深度分析 page (client/analysis.ts AnalysisTab): the automatic switch and what one run costs, one card for
// where things stand, then the imported report: summary, organ table, question board, the plan read back
// with 接受方案, the items for the doctor (and the brief), and the comparison with the analysis before.
import type { Ctx, Node, Page } from '../types.ts'
import { routeState } from '../kit.tsx'
import { FailLine } from './research/bits.tsx'
import type { Status } from './research/analysis-data.ts'
import { BoardCard, BriefView, CompareCard, DoctorCard, OrgansCard, PlanCard, ReportCard, ReportView } from './research/analysis-report.tsx'
import { AboutCard, StatusCard } from './research/analysis-status.tsx'

const POLL_MS = 15_000

function draw(ctx: Ctx): Node {
  const { Box, Text } = ctx.E
  const state = routeState(ctx, 'analysis')
  if (state.kind === 'loading') return <Text dimColor>读取中…</Text>
  if (state.kind === 'error') return FailLine(ctx, 'analysis', state.error, 'analysis-failed', '读取深度分析状态失败')
  const status = state.json as unknown as Status
  const cur = status.current
  if (ctx.view.detail === 'report') return ReportView(ctx, cur)
  if (ctx.view.detail === 'brief') return BriefView(ctx)

  const runs = status.runs ?? []
  const running = runs.find((r) => r.active) ?? null
  const ready = runs.find((r) => r.report_ready && r.id !== cur?.run_id) ?? null
  const stopped = runs.find((r) => !r.active && !r.report_ready) ?? null
  // Stage progress while a run is going: read the status again when the pane redraws and it is older than 15 s.
  const held = ctx.route('analysis')
  if (running && held && !held.loading && ctx.now - held.at > POLL_MS) ctx.act.load(['analysis'], true)
  const back = status.plan_read_back
  const canStart = !status.blockers && !running && !stopped && !ready

  return (
    <Box flexDirection="column" width={ctx.width}>
      {AboutCard(ctx, status, canStart)}
      {StatusCard(ctx, status, { running, stopped, ready })}
      {cur ? ReportCard(ctx, cur, back?.items.length ?? 0) : null}
      {cur ? OrgansCard(ctx, cur) : null}
      {cur ? BoardCard(ctx, cur) : null}
      {cur && back ? PlanCard(ctx, cur, back) : null}
      {cur ? DoctorCard(ctx, cur) : null}
      {cur?.compare ? CompareCard(ctx, cur.compare) : null}
    </Box>
  )
}

export const page: Page = {
  tab: 'analysis',
  label: '深度分析',
  // The full report's text is read only while it is open (it is the report file, not JSON).
  routes: (view) => (view.detail === 'report' ? ['analysis', 'analysis/report'] : ['analysis']),
  draw,
}
