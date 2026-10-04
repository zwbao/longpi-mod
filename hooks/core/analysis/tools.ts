// M12 tools: prepare a deep analysis run, import its result, read the imported result.
// The analysis itself is the longevity-analyst skill running in this dsh session.

import type { Context } from '../../sys/cordis.ts'
import { defineTool } from '../../sys/dsh-tools.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { asJson } from '../json.ts'
import { jsonOut } from '../core/tool-kit.ts'
import { COST_ZH, SKILL_NAME, currentSummary, importLatest, planReadBack, startRun, statusNow } from './service.ts'

export function registerAnalysisTools(ctx: Context, deps: CoreDeps): void {
  ctx.tools.register(defineTool({
    name: 'run_deep_analysis',
    description: `Start a deep multi-omics analysis with the ${SKILL_NAME} skill for the person whose record is shown (biological age, organ checkup table, disease risks, gene-vs-lab insights, a question board, an intervention plan). It costs a lot (${COST_ZH}). Follow the snapshot line 深度分析: trigger "ai" only when it says automatic deep analysis is on and can start (the plugin refuses otherwise); trigger "member" when the person said yes to your question or asked for one (DSH then asks them to confirm). Returns the exact request to carry out: then load the ${SKILL_NAME} skill yourself and do what prompt_zh says.`,
    parameters: {
      trigger: { type: 'string', enum: ['ai', 'member'], required: true, description: '"ai": automatic (switch on, snapshot says it can start); "member": the person said yes or asked, in this conversation.' },
      reason_zh: { type: 'string', required: true, description: 'Why now, in one or two Chinese sentences naming the facts (e.g. 9 月体检后有了新的化验和手表数据). Shown on the health page.' },
      data_folder: { type: 'string', description: 'Folder with the person\'s omics files if they named one; omit to use the folder remembered from before (or only Mirobody).' },
    },
    output: jsonOut,
    timeoutMs: 60_000,
    isConcurrencySafe: () => false,
    async execute(args: { trigger?: string; reason_zh?: string; data_folder?: string }) {
      const res = await startRun(deps, { dataFolder: args.data_folder ?? null, trigger: args.trigger === 'member' ? 'member' : 'ai', reasonZh: String(args.reason_zh ?? '') })
      if (!res.ok) return asJson({ ok: false, reply_zh: res.reply_zh, missing: res.missing, how_to_use: 'Do not start the skill. If the person asked, say reply_zh; otherwise say nothing about it unless it helps them (e.g. a missing consent).' })
      return asJson({
        ...res,
        how_to_use: `Load the ${SKILL_NAME} skill and carry out prompt_zh as the person's request (it is written in their voice). Never print the MCP URL file's contents. When la.py report is done, call import_analysis yourself. Before the conversation ends, if the analysis is still running or was not due, you may schedule yourself to check again (the schedule tool).`,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'import_analysis',
    description: 'Bring a finished deep analysis into LongPi: its report, organ table, question board and readouts appear on the 健康 page (深度分析). Returns the plan read back for the person. The plan is saved only after they confirm it: then call save_intervention_plan with the returned plan (confirm:false first, read it back, then confirm:true), or they click 接受方案 on the page.',
    parameters: {
      run_id: { type: 'string', description: 'A run id from run_deep_analysis; omit for the latest finished run.' },
    },
    output: jsonOut,
    timeoutMs: 60_000,
    isConcurrencySafe: () => false,
    async execute(args: { run_id?: string }) {
      const res = await importLatest(deps, args.run_id ?? null)
      if (!res.ok) return asJson({ ...res, how_to_use: 'Say error_zh; the problems list is for you, not the person.' })
      return asJson({
        ...res,
        plan_for_save: res.read_back.plan,
        how_to_use: 'Tell the person the result is on the 健康 page under 深度分析. Read the plan items back in plain words (no doses) and ask whether to adopt it; only on a yes, save it through save_intervention_plan with plan_for_save. read_back.doctor_items are for a doctor (supplements, tests, referrals): never add them to the plan; say how many there are and offer the doctor brief (prepare_doctor_brief), which lists them. When compare is ok, name only the rows whose verdict is beyond noise, with both values; within_noise means the change cannot be told from normal fluctuation yet; never call a not-judged value better or worse. A compare alert (a genotype that changed) comes first.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_deep_analysis',
    description: 'The imported deep analysis (readouts, organ table, question board with verdicts, the plan, the items for a doctor, retests, and the comparison with the previous analysis) and the progress of any run still going. Read-only. Use when the person asks about their deep analysis report, a question on its board, or what changed since the last analysis.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 30_000,
    isConcurrencySafe: () => true,
    async execute() {
      const status = await statusNow(deps)
      const current = currentSummary(deps.dataDir())
      return asJson({
        readiness: status.readiness,
        runs: status.runs.map((r) => ({ id: r.id, started_at: r.started_at, trigger: r.trigger, reason_zh: r.reason_zh, done: `${r.done}/${r.stages.length}`, report_ready: r.report_ready, active: r.active })),
        current,
        plan_read_back: current ? await planReadBack(deps) : null,
        how_to_read: 'AI 估计 readouts are estimates with ranges, not measurements; a genetic percentile is a tendency, not a diagnosis; a ClinVar finding needs clinical confirmation and genetic counselling. Quote numbers as they are here. current.doctor_items are for a doctor, not the plan (offer prepare_doctor_brief). current.compare compares this analysis with the previous one by the reference change value: only increase_beyond_noise or decrease_beyond_noise is a real change; within_noise is not yet; not_judged values are shown side by side, never called better or worse.',
      })
    },
  }))
}
