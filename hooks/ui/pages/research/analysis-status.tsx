// 深度分析: what it is, the automatic switch with what a run costs, and one card for where things stand
// (a run going, a stopped run, a finished run to import, why it cannot start, or what LongPi sees now).
// In Claude Code the analysis is something Claude runs in the background; starting one is a request to Claude.
import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, Section } from '../../kit.tsx'
import { Callout, Fold, isOpen, meter, P, Tick } from './bits.tsx'
import type { Run, Status } from './analysis-data.ts'
import { dateOf, t } from './format.ts'

const START_SAY = '帮我做一次深度分析：用我已有的体检、化验和检测数据，估算生物学年龄、各器官状况和疾病风险，逐一查证问题，最后给我一份可执行的方案。'

function toggleAuto(ctx: Ctx, status: Status, on: boolean): void {
  const save = () => ctx.act.post('analysis/settings', { auto: on }, {
    reload: ['analysis'],
    done: on ? '已开启自动深度分析：有新数据时，LongPi 将自动开始分析。' : '已关闭自动深度分析：仅在关键时间点征求你的意见。',
  })
  if (!on) {
    void save()
    return
  }
  void ctx.act.ask(`开启后，有新的检测文件时 LongPi 会自动开始深度分析。${t(status.cost_zh)}，会消耗大量 token。确定开启吗？`, ['开启', '先不开'], '自动深度分析').then((choice) => {
    if (choice === '开启') void save()
  })
}

export function startAnalysis(ctx: Ctx, status: Status): void {
  void ctx.act.ask(`${t(status.cost_zh)}，会消耗大量 token。现在请 Claude 开始一次深度分析吗？`, ['开始', '先不'], '深度分析').then((choice) => {
    if (choice === '开始') ctx.act.say(START_SAY)
  })
}

export function AboutCard(ctx: Ctx, status: Status, canStart: boolean): RenderElement {
  const { Box, Button } = ctx.E
  const auto = Boolean(status.readiness?.auto_on)
  return Section(ctx.E, {
    key: 'about', title: '关于深度分析', width: ctx.width,
    children: [
      P(ctx, '根据全基因组、甲基化、肠道菌、蛋白组和体检数据，估算生物学年龄、各器官状况和未来的疾病风险，提出针对性问题并逐一查证，最后给出一份可执行的方案。分析由 Claude 在后台进行；也可随时在对话中直接发起。', 'what', { dim: true }),
      <Box key="switch" marginTop={1}>{Tick(ctx.E, { key: 'auto', label: `自动深度分析（${auto ? '已开启' : '已关闭'}）`, on: auto, onPress: () => toggleAuto(ctx, status, !auto) })}</Box>,
      Callout(ctx.E, `注意：${t(status.cost_zh)}，会消耗大量 token。开启后，有新的体检、化验或检测文件时，LongPi 会自动判断并开始分析（同一人两次自动分析至少间隔 30 天）；关闭时（默认），仅在关键时间点征求你的意见，经你同意后才开始。此开关对你和家人均生效。`, 'warn', 'cost', ctx.width - 4),
      canStart
        ? (
          <Box key="start" flexDirection="row" gap={1} marginTop={1}>
            <Button key="start-analysis" label="请 Claude 开始一次深度分析" onPress={() => startAnalysis(ctx, status)} />
          </Box>
        )
        : null,
    ],
  })
}

/** 上次分析 9 月 13 日 · 之后有新数据（最新 10 月 3 日）. */
function readinessLine(ctx: Ctx, status: Status): string {
  const r = status.readiness
  if (!r) return ''
  const newest = r.newest ?? r.newest_record ?? r.newest_file
  const last = r.last_analysis ? `上次分析：${dateOf(r.last_analysis, ctx.today)}` : '还没有做过深度分析'
  if (r.new_data === true) return `${last} · 之后有新数据${newest ? `（最新 ${dateOf(newest, ctx.today)}）` : ''}`
  if (r.new_data === false) return `${last} · 之后没有新数据`
  return last
}

function Stages(ctx: Ctx, run: Run, running: boolean): RenderElement {
  const { Box, Text } = ctx.E
  const now = running ? run.stages.findIndex((s) => !s.done) : -1
  return (
    <Box key="stages" flexDirection="column">
      {run.stages.map((s, i) => (
        <Box key={`stage-${s.key}`} flexDirection="row" gap={1}>
          <Text color={s.done ? C.good : i === now ? C.accent : C.dim}>{s.done ? '✓' : i === now ? '▶' : '○'}</Text>
          <Text dimColor={!s.done && i !== now} bold={i === now}>{t(s.label_zh)}</Text>
        </Box>
      ))}
    </Box>
  )
}

export function StatusCard(ctx: Ctx, status: Status, runs: { running: Run | null; stopped: Run | null; ready: Run | null }): Node {
  const { Box, Text, Button } = ctx.E
  const { running, stopped, ready } = runs
  const run = running ?? stopped
  const width = ctx.width
  const inner = width - 4
  const doImport = (id: string) => void ctx.act.post('analysis/import', { run_id: id }, { reload: ['analysis'], done: '结果已导入。' })
  const abandon = (id: string) => {
    void ctx.act.ask('放弃这次分析？已经做完的步骤不会保留。', ['放弃这次分析', '先不放弃'], '深度分析').then((choice) => {
      if (choice === '放弃这次分析') void ctx.act.post('analysis/abandon', { run_id: id }, { reload: ['analysis'], done: '已放弃这次分析。' })
    })
  }

  if (run) {
    const total = run.stages.length
    const folded = !running || run.done === 0
    const firstOpen = run.stages.findIndex((s) => !s.done)
    const at = firstOpen < 0 ? Math.max(total - 1, 0) : firstOpen
    const nowLabel = run.stages[at]?.label_zh ?? ''
    const summary = running
      ? `正在进行第 ${at + 1} 步${nowLabel ? `「${t(nowLabel)}」` : ''} · 共 ${total} 步`
      : `停在第 ${at + 1} 步${nowLabel ? `「${t(nowLabel)}」` : ''} · 共 ${total} 步`
    return Section(ctx.E, {
      key: 'status', title: running ? '分析进行中' : '上次分析未完成', note: folded ? '' : `${run.done}/${total}`, width, tone: running ? C.accent : C.warn,
      children: [
        <Text key="bar" color={C.accent}>{meter(total ? run.done / total : 0, Math.min(40, inner))}</Text>,
        folded ? <Text key="summary">{summary}</Text> : null,
        folded ? Fold(ctx, 'an.steps', '展开步骤', '收起步骤') : null,
        folded && !isOpen(ctx, 'an.steps') ? null : Stages(ctx, run, Boolean(running)),
        running && run.reason_zh ? P(ctx, `${run.trigger === 'ai' ? 'LongPi 发起' : '你发起'}：${t(run.reason_zh)}`, 'reason', { dim: true }) : null,
        running ? null : P(ctx, '可在对话里说「继续」，或放弃后重新发起。', 'resume', { dim: true }),
        run.state_error ? Callout(ctx.E, t(run.state_error), 'warn', 'state-err', inner) : null,
        ready
          ? (
            <Box key="ready" flexDirection="column" marginTop={1}>
              {Callout(ctx.E, '另有一份分析已完成，可以先导入。', 'good', 'ready-note', inner)}
              <Button key="import-other" label="导入结果" onPress={() => doImport(ready.id)} />
            </Box>
          )
          : null,
        <Box key="foot" flexDirection="row" gap={1} marginTop={1} flexWrap="wrap">
          {running ? null : <Button key="resume" label="继续这次分析" onPress={() => ctx.act.say('继续上次没做完的深度分析。')} />}
          <Button key="abandon" label="放弃这次分析" onPress={() => abandon(run.id)} />
          {running ? <Text dimColor>每分钟自动刷新</Text> : null}
        </Box>,
      ],
    })
  }

  if (ready) {
    return Section(ctx.E, {
      key: 'status', title: '有一份新的分析已完成', width, tone: C.good,
      children: [
        P(ctx, '导入后可在此查看报告、器官体检表和方案。', 'text', { dim: true }),
        P(ctx, '导入后，报告和问题看板会显示在下面。', 'cap', { dim: true }),
        <Button key="import" variant="primary" label="导入结果" onPress={() => doImport(ready.id)} />,
      ],
    })
  }

  const line = readinessLine(ctx, status)
  const blocked = status.blockers
  if (blocked) {
    return Section(ctx.E, {
      key: 'status', title: '暂时无法进行', width, tone: C.warn,
      children: [Callout(ctx.E, t(blocked.reply_zh), 'info', 'blocked', inner), line ? P(ctx, line, 'ready-line', { dim: true }) : null],
    })
  }

  const readiness = status.readiness
  if (!readiness) return null
  return Section(ctx.E, {
    key: 'status', title: readiness.auto_on ? 'LongPi 的判断' : '当前状态', width,
    children: [
      P(ctx, t(readiness.why_zh) || '现在没有进行中的分析。', 'why'),
      line ? P(ctx, line, 'ready-line', { dim: true }) : null,
      readiness.folder ? P(ctx, `检测文件夹：${t(readiness.folder)}（只读）`, 'folder', { dim: true }) : null,
    ],
  })
}
