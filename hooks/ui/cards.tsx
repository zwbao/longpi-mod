// LongPi's tool calls in the transcript, drawn as small cards instead of raw JSON (the web's toolviews.ts and
// turn-tail.ts): a plan draft with 采用这份方案, a read-back with 确认保存 / 还要调整, check-ins with 撤销,
// body age and cardiovascular risk as a figure, the record read or filled. Pure: the call and actions in.

import type { RenderElement } from 'claude-code'

import { isoDay } from '../core/interventions.ts'
import { C, fit, zh } from './kit.tsx'
import type { Els } from './types.ts'

export type CardCall = { tool: string; input: Record<string, unknown>; output: unknown; isRunning: boolean; isErrored: boolean }
export type CardState = { adopted?: number; undone?: boolean; busy?: boolean; error?: string }

export type CardActions = {
  adoptDraft: (draft: Record<string, unknown>, source: { focus: string[]; markers: string[] }) => void
  undoCheckins: (items: string[]) => void
  fill: (text: string) => void
  open: (tab: string) => void
}

const PHENOAGE = 'accelerated-biological-aging-risk'
const RISK = 'china-par-ascvd-risk'

/** What each of LongPi's tools does, for its one-line card. */
export const TOOL_ZH: Record<string, string> = {
  read_personal_situation: '读取档案与记录',
  list_longevity_intents: '查看问题类型',
  match_longevity_skills: '挑选方法',
  read_longevity_skill: '阅读方法说明',
  bind_longevity_inputs: '核对方法的输入',
  run_longevity_skill: '运行方法',
  query_longevity_evidence: '查研究证据',
  list_longevity_domains: '查看方法库',
  save_personal_profile: '保存档案',
  longpi_status: 'LongPi 状态',
  save_intervention_plan: '保存方案',
  draft_intervention_plan: '起草方案',
  log_intervention_checkin: '打卡',
  save_self_measurement: '记录自测',
  record_medication_statement: '记下用药',
  read_intervention_plan: '读取方案',
  review_interventions: '评估方案效果',
  model_intervention_goals: '估算目标效果',
  set_followup: '设置提醒',
  send_followup_message: '发送提醒',
  read_person_memory: '读取记下的事',
  remember_for_me: '记下这件事',
  note_page_issue: '记下页面问题',
  read_care_navigation: '就医建议',
  prepare_doctor_brief: '准备医生简报',
  log_care_visit: '记下就医',
  run_deep_analysis: '深度分析',
  import_analysis: '导入深度分析',
  read_deep_analysis: '读取深度分析',
  import_member_file: '导入会员档案',
  read_season: '读取长寿图鉴',
  log_life_event: '记下生活事件',
  forward_report: '转交报告',
  read_narrative_findings: '读取报告里的文字结论',
  record_condition: '记下身体状况',
  read_progress_feedback: '读取进展',
  list_studies: '查看研究',
  explain_study: '解释研究',
  design_n_of_1: '设计个人实验',
  log_n_of_1_outcome: '记下个人实验结果',
  record_study_consent: '记录研究同意',
  withdraw_from_study: '退出研究',
  record_measurements: '录入体检数值',
  import_measurements_csv: '导入数据',
}

type Raw = Record<string, unknown>

function objectOf(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string' && row.length > 0) : []
}

/** The tool's JSON answer, from whatever shape the transcript stored. */
export function resultOf(output: unknown): Raw | null {
  let text = ''
  if (typeof output === 'string') text = output
  else if (Array.isArray(output)) text = output.map((part) => (typeof part === 'string' ? part : String(objectOf(part).text ?? ''))).join('')
  else if (output && typeof output === 'object') {
    const content = (output as Raw).content
    if (Array.isArray(content)) text = content.map((part) => String(objectOf(part).text ?? '')).join('')
    else if (typeof (output as Raw).result === 'string') text = String((output as Raw).result)
    else return output as Raw
  }
  const at = text.indexOf('{')
  if (at < 0) return null
  try {
    return JSON.parse(text.slice(at)) as Raw
  } catch {
    return null
  }
}

function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function fmt(value: number, digits = 1): string {
  const fixed = value.toFixed(digits)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

function shell(E: Els, title: string, summary: string, opts: { tone?: string; children?: Array<RenderElement | null>; width: number }): RenderElement {
  const { Box, Text } = E
  return (
    <Box flexDirection="column" paddingLeft={2} width={opts.width}>
      <Box flexDirection="row" gap={1}>
        <Text color={C.teal}>◆ LongPi</Text>
        <Text bold>{title}</Text>
        {summary ? <Text color={opts.tone ?? undefined} dimColor={!opts.tone}>{fit(summary, Math.max(10, opts.width - title.length * 2 - 14))}</Text> : null}
      </Box>
      {(opts.children ?? []).filter((child): child is RenderElement => child !== null)}
    </Box>
  )
}

export function cardTree(E: Els, call: CardCall, state: CardState, act: CardActions, width: number): RenderElement | null {
  const { Box, Text, Button } = E
  const name = call.tool.replace(/^mcp__longpi__/, '')
  const label = TOOL_ZH[name] ?? name
  if (call.isRunning) return shell(E, label, '…', { width })
  if (call.isErrored) return null
  const result = resultOf(call.output)
  if (!result) return shell(E, label, '', { width })

  if (name === 'read_personal_situation') {
    const indicators = numberOf(result.indicator_count)
    const summary = objectOf(result.records_summary)
    const checkups = numberOf(summary.checkups)
    const counts = [checkups ? `${checkups} 次体检` : '', indicators ? `${indicators} 项指标` : ''].filter(Boolean).join('，')
    const changes = (Array.isArray(result.record_changes) ? result.record_changes : []).map(objectOf).filter((row) => row.ask_doctor === true)
    return shell(E, '已读取你的档案与记录', counts, {
      width,
      children: [changes.length > 0 ? <Text key="doc" color={C.warn} wrap="wrap">{zh(`⚠ ${changes.slice(0, 3).map((row) => String(row.label_zh ?? '')).filter(Boolean).join('、')}的变化超出正常波动。`)}</Text> : null],
    })
  }

  if (name === 'record_measurements' || name === 'import_measurements_csv') {
    const saved = numberOf(result.saved) ?? 0
    const already = numberOf(result.already_on_file) ?? 0
    const problems = strings(result.problems)
    return shell(E, saved > 0 ? `已录入 ${saved} 项` : '没有新的数值', already > 0 ? `${already} 项之前已有` : '', {
      width,
      tone: saved > 0 ? C.good : C.warn,
      children: [
        problems.length > 0 ? <Text key="p" dimColor wrap="wrap">{zh(problems.slice(0, 3).join('；'))}</Text> : null,
        saved > 0 ? <Box key="b" flexDirection="row" gap={1}><Button key="to-labs" plain label="在化验页看 ›" onPress={() => act.open('labs')} /></Box> : null,
      ],
    })
  }

  if (name === 'draft_intervention_plan') {
    const draft = objectOf(result.draft)
    const items = (Array.isArray(draft.items) ? draft.items : []).map(objectOf)
    if (items.length === 0) return shell(E, '起草方案', typeof result.reply_zh === 'string' ? '' : '没有起草', { width })
    const brief = objectOf(result.brief)
    const source = { focus: strings(brief.focus), markers: strings(call.input.markers) }
    return shell(E, `方案草稿 · ${items.length} 项`, state.adopted ? `已采用为方案第 ${state.adopted} 版` : '', {
      width,
      tone: state.adopted ? C.good : undefined,
      children: [
        ...items.slice(0, 8).map((item, i) => <Text key={`it${i}`} wrap="truncate-end">{`  ${i + 1}. ${String(item.title ?? '')}${item.detail ? ` · ${String(item.detail)}` : ''}`}</Text>),
        state.error ? <Text key="err" color={C.warn}>{state.error}</Text> : null,
        state.adopted ? null : (
          <Box key="acts" flexDirection="row" gap={1}>
            <Button key="adopt" label={state.busy ? '正在采用…' : '采用这份方案'} variant="primary" onPress={() => { if (!state.busy) act.adoptDraft(draft, source) }} />
            <Button key="adjust" label="还要调整" onPress={() => act.fill('这份方案我想调整：')} />
            <Button key="to-plan" plain label="在方案页看 ›" onPress={() => act.open('plan')} />
          </Box>
        ),
      ],
    })
  }

  if (name === 'save_intervention_plan') {
    const back = objectOf(result.read_back)
    const items = (Array.isArray(back.items) ? back.items : []).map((row) => (typeof row === 'string' ? row : String(objectOf(row).text ?? objectOf(row).title ?? '')))
    if (result.saved === true) return shell(E, '方案已保存', numberOf(result.version) ? `第 ${numberOf(result.version)} 版` : '', { width, tone: C.good, children: [<Button key="to-plan" plain label="在方案页看 ›" onPress={() => act.open('plan')} />] })
    if (result.ok === true && result.saved === false) {
      return shell(E, '方案复述', '还没保存', {
        width,
        children: [
          ...items.slice(0, 10).map((line, i) => <Text key={`rb${i}`} wrap="truncate-end">{`  ${line}`}</Text>),
          <Box key="acts" flexDirection="row" gap={1}>
            <Button key="confirm" label="确认保存" variant="primary" onPress={() => act.fill('可以，就按这份方案保存吧')} />
            <Button key="adjust" label="还要调整" onPress={() => act.fill('这份方案我想调整：')} />
          </Box>,
        ],
      })
    }
    return shell(E, '保存方案', typeof result.error === 'string' ? result.error : '', { width, tone: C.warn })
  }

  if (name === 'log_intervention_checkin') {
    const entries = (Array.isArray(result.entries) ? result.entries : []).map(objectOf)
    const answered = entries.filter((row) => row.undo !== true && typeof row.done === 'boolean')
    const today = isoDay()
    const undoable = answered.filter((row) => String(row.date ?? '') === today).map((row) => String(row.item ?? '')).filter(Boolean)
    const names = answered.map((row) => `${String(row.title ?? row.item ?? '')}${row.done === false ? '（未完成）' : ''}`).join('、')
    if (entries.length === 0) return shell(E, '打卡', '记录失败', { width, tone: C.warn })
    return shell(E, state.undone ? '已撤销' : '已记录', names, {
      width,
      tone: state.undone ? undefined : C.good,
      children: [!state.undone && undoable.length > 0 ? <Button key="undo" plain label={state.busy ? '撤销中' : '撤销'} onPress={() => { if (!state.busy) act.undoCheckins(undoable) }} /> : null],
    })
  }

  if (name === 'run_longevity_skill') {
    const skill = typeof call.input.name === 'string' ? call.input.name : ''
    const outputs = objectOf(result.outputs)
    const value = (key: string) => numberOf(objectOf(outputs[key]).value)
    if (result.ok !== true) return shell(E, '运行方法', `未能算出：${typeof result.error === 'string' ? result.error : String(result.error_kind ?? '')}`, { width, tone: C.warn })
    if (skill === PHENOAGE && value('phenoage') != null) {
      return shell(E, '身体年龄', `${fmt(value('phenoage') as number)} 岁 · 模型估计`, { width, tone: C.accent, children: [<Button key="to-o" plain label="在总览看 ›" onPress={() => act.open('overview')} />] })
    }
    if (skill === RISK && value('risk_10y_pct') != null) {
      const category = objectOf(outputs.risk_category).value
      return shell(E, '10 年心血管风险', `${fmt(value('risk_10y_pct') as number)}%${typeof category === 'string' ? ` · ${category}` : ''} · 模型估计`, { width, tone: C.accent, children: [<Button key="to-o" plain label="在总览看 ›" onPress={() => act.open('overview')} />] })
    }
    const first = Object.values(outputs).map(objectOf).find((row) => typeof row.label_zh === 'string')
    return shell(E, String(first?.label_zh ?? '方法'), '已算出', { width })
  }

  return shell(E, label, result.ok === false && typeof result.error === 'string' ? result.error : '', { width, tone: result.ok === false ? C.warn : undefined })
}
