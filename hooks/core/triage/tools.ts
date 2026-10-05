// M1 tools: where the person stands with the doctor (read_care_navigation), the printable brief
// (prepare_doctor_brief) and what happened after the advice (log_care_visit).

import type { Context } from '../../sys/cordis.ts'
import { defineTool } from '../../sys/dsh-tools.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { asJson } from '../json.ts'
import { NO_STOP } from '../doctor-first.ts'
import { buildTracking } from '../tracking.ts'
import { jsonOut, sessionOfExec } from '../core/tool-kit.ts'
import { lastPersonText, quoteIn } from '../core/turn-text.ts'
import { isoDay } from '../interventions.ts'
import { careItems, careState, logCareVisit, type CareStatus } from './care.ts'
import { buildBrief, readBrief } from './brief.ts'

async function stateNow(deps: CoreDeps) {
  const context = await deps.context()
  const tracking = await buildTracking(context)
  return { context, care: careState(context.dataDir, tracking.doctor_first ?? NO_STOP, context.today) }
}

export function registerTriageTools(ctx: Context, deps: CoreDeps): void {
  ctx.tools.register(defineTool({
    name: 'read_care_navigation',
    description: 'What in this person\'s record needs a doctor before any lifestyle plan (findings: the values with their dates and fall across checkups, which department, questions to ask, tests to request), and what they told LongPi about going (care: advised, booked with a date, visited with what the doctor said, declined). Read-only. Use it when they ask 该不该去看医生, what to prepare, or after they mention a visit.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 120000,
    isConcurrencySafe: () => true,
    async execute() {
      const { care } = await stateNow(deps)
      const answers = careItems(deps.dataDir())
      const due = answers.some((item) => item.care_status === 'booked' && item.visit_date && item.visit_date < new Date().toISOString().slice(0, 10))
      return asJson({
        findings: care.findings.map(({ id, title_zh, text_zh, department_zh, questions_zh, tests_to_request_zh, status, priority }) => ({ id, title_zh, text_zh, department_zh, questions_zh, tests_to_request_zh, status, priority })),
        care: answers.map(({ finding_id, care_status, visit_date, outcome_zh, text_zh }) => ({ finding_id, care_status, visit_date, outcome_zh, text_zh })),
        doctor_first_zh: care.stop.stop ? care.stop.sentence_zh : '',
        seen_by_doctor: care.seen.map(({ finding, care: item }) => ({ finding_id: finding.id, visit_date: item.visit_date ?? null, outcome_zh: item.outcome_zh ?? null })),
        ...(due ? { ask_zh: '约的就诊日期已经过了：先问一句「看完医生了吗？医生怎么说？」，再用 log_care_visit 记下。' } : {}),
        how_to_read: 'Say each finding with its numbers and call a low value 偏低. Offer the one-page brief (prepare_doctor_brief). Never name a cause, a diagnosis, iron, a supplement, a drug or a dose; what to take is the doctor\'s decision. When they tell you about a visit, record it with log_care_visit in their words.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'prepare_doctor_brief',
    description: 'Make the one-page brief to bring to the doctor: why this visit, the values across checkups as a table, medicines and conditions on file, questions to ask, tests to request. Returns the brief as markdown (the name line is left blank to fill in by hand) and where the page shows it for printing or saving. Deterministic: the numbers come from the record.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 120000,
    isConcurrencySafe: () => false,
    async execute() {
      const { context, care } = await stateNow(deps)
      const made = await buildBrief({ config: context.config, dataDir: context.dataDir, records: context.records, today: context.today, care })
      if (!made) return asJson({ ok: false, reply_zh: '记录里现在没有需要先给医生看的结果，所以不需要简报。' })
      return asJson({
        ok: true,
        id: made.brief.id,
        markdown: made.markdown,
        where_zh: '健康页「总览」最上面的「最重要的一步」里有「医生简报」，可以存成可打印的网页。',
        how_to_use: 'Tell them the brief is ready and where to print or save it, and summarise it in two or three lines (why, the trend, what to ask). Do not paste the whole table unless they ask. Never add a cause, a diagnosis or a dose.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'log_care_visit',
    description: 'Record what the person says about seeing the doctor for a finding. booked is stored only when quote is their own words from this message AND those words say they booked, with the date (我约了10月5日). A date you inferred, a plan to go (下周一去社区医院), or the page\'s old line is not a booking: it stays a proposal and is not shown as 已约. If they say they did not book it (没约那一天), pass that quote and the booking is deleted and stays deleted. visited: what the doctor said, in their words. declined: they will not go for now. A visit lets the plan go ahead with the doctor\'s conclusion noted; the doctor\'s treatment itself (iron, medicines, doses) is never put into the plan.',
    parameters: {
      status: { type: 'string', enum: ['booked', 'visited', 'declined', 'advised'], required: true, description: 'booked: an appointment is made; visited: they saw the doctor; declined: they will not go for now.' },
      visit_date: { type: 'string', description: 'YYYY-MM-DD of the appointment or the visit, when they said it.' },
      outcome: { type: 'string', description: 'What the doctor said, in the person\'s words (诊断、开了什么、多久复查). Leave out when they did not say.' },
      department: { type: 'string', description: 'The department, when they said it.' },
      finding_id: { type: 'string', description: 'From read_care_navigation; default the first open finding.' },
      quote: { type: 'string', description: 'The person\'s own words from this message that say it.' },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const { care } = await stateNow(deps)
      const session = sessionOfExec(exec)
      const quote = typeof args.quote === 'string' ? args.quote.trim() : ''
      const said = lastPersonText(session)
      const booking = String(args.status) === 'booked'
      // No words of theirs to check against (a scheduled or restarted turn): not confirmed on the model's say-so.
      const confirmed = booking ? undefined : !said ? false : !quote ? true : quoteIn(quote, said)
      const result = logCareVisit(deps.dataDir(), {
        status: String(args.status) as CareStatus,
        ...(typeof args.visit_date === 'string' ? { visit_date: args.visit_date.slice(0, 10) } : {}),
        ...(typeof args.outcome === 'string' ? { outcome_zh: args.outcome } : {}),
        ...(typeof args.department === 'string' ? { department_zh: args.department } : {}),
        ...(typeof args.finding_id === 'string' ? { finding_id: args.finding_id } : {}),
        ...(quote ? { quote_zh: quote } : {}),
        said_zh: said,
        today: isoDay(),
        via: 'chat', session_id: session,
        ...(confirmed !== undefined ? { confirmed } : {}),
      }, care.findings)
      if (!result.ok) return asJson({ ok: false, error: result.error })
      deps.invalidate()
      const booked = result.item.care_status === 'booked' && result.item.confirmed !== false && !result.cleared
      return asJson({
        ok: true,
        saved_zh: result.item.text_zh,
        confirmed: result.item.confirmed === true && !result.cleared,
        ...(result.cleared ? { deleted: true } : {}),
        next_zh: result.cleared
          ? '已删除这条预约。页头和随访不再使用该日期；除非你本人再次说明「我约了某月某日」，否则不会恢复。'
          : result.kept
            ? '原话里没有新的预约，已有的日期保持不动。'
            : result.item.care_status === 'visited'
              ? '已记录。医生已查看这些结果，方案现可仅按生活方式起草；医生开具的药物或补铁遵医嘱执行，不纳入方案。'
              : booked
                ? '已记录就诊日期。就诊前可打印医生简报；就诊后请告诉我医生的意见。'
                : '未记录为已预约。只有你本人说明预约日期，才会显示在页头。',
      })
    },
  }))
}

export { readBrief }
