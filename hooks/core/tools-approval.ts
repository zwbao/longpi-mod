// Approval for saving a plan from chat (claim 8d) and for starting a deep analysis.
// save_intervention_plan with confirm=true now waits for the person to approve in DSH, and only after the
// same plan was read back (confirm=false) in this process within the last 30 minutes. The tool body is
// unchanged: these are tools/pre-execute and tools/post-execute listeners, in the same shape as the
// set_followup one in tools-followup.ts.

import { createHash } from '../sys/crypto.ts'
import type { Context } from '../sys/cordis.ts'
import { CATEGORY_ZH, isoDay, normalizePlan, type Category } from './interventions.ts'
import { COST_ZH } from './analysis/service.ts'

export const READ_BACK_MS = 30 * 60_000
export const NO_READ_BACK = '请先复述方案给用户确认'
const SAVE_TOOL = 'save_intervention_plan'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** The plan as it would be stored, without the generated item ids and medication links. */
function normalized(args: unknown) {
  const { confirm: _confirm, ...plan } = record(args)
  return normalizePlan(plan, { today: isoDay(), medications: [], previous: null }).plan
}

/** Same normalized plan, same key: title, source, note, each item's fields in order, and the goals. */
export function planKey(args: unknown): string {
  const plan = normalized(args)
  const canonical = {
    title: plan.title,
    source: plan.source,
    note: plan.note,
    items: plan.items.map(({ id: _id, mirobody: _mirobody, ...item }) => item),
    goals: plan.goals,
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

/** What the person approves in DSH: the plan's title, then each item with its category and start date. */
export function planApprovalReason(args: unknown): string {
  const plan = normalized(args)
  const shown = plan.items.slice(0, 12).map((item, index) => `${index + 1}. ${CATEGORY_ZH[item.category as Category] ?? '其他'}·${item.title || '（未命名）'}（${item.start || '未写开始日期'} 开始）`)
  const more = plan.items.length > shown.length ? `；另有 ${plan.items.length - shown.length} 项` : ''
  const goals = plan.goals.length > 0 ? `；另有 ${plan.goals.length} 个目标值` : ''
  return `LongPi 要保存干预方案「${plan.title}」：${shown.join('；')}${more}${goals}。只有你本人确认过这份方案才同意。`
}

const readBacks = new Map<string, number>()

function rememberReadBack(key: string, now = Date.now()): void {
  for (const [other, at] of readBacks) if (now - at > READ_BACK_MS) readBacks.delete(other)
  readBacks.set(key, now)
  if (readBacks.size > 200) readBacks.delete(readBacks.keys().next().value as string)
}

function hasReadBack(key: string, now = Date.now()): boolean {
  const at = readBacks.get(key)
  return at !== undefined && now - at <= READ_BACK_MS
}

/** Tests: forget every read-back. */
export function resetReadBacks(): void {
  readBacks.clear()
}

export function registerApprovals(ctx: Context, opts: { analysisBlocked?: () => boolean } = {}): void {
  // After every other listener allowed it: a confirmed save needs a fresh read-back and then the person's yes.
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    if (decision.kind !== 'allow') return decision
    // A deep analysis the person asks for costs about half a million tokens: DSH asks them, so "member" is their yes,
    // never only the model's word. An automatic start ("ai") is allowed only with the page switch on (checked in M12).
    // A start LongPi would refuse anyway (the demo profile, no analyst, no age) is not put to them: the tool says why.
    if (exec.name === 'run_deep_analysis' && record(exec.arguments).trigger !== 'ai') {
      if (opts.analysisBlocked?.()) return decision
      return { kind: 'ask', reason: `开始一次深度分析？${COST_ZH}。` }
    }
    if (exec.name !== SAVE_TOOL || record(exec.arguments).confirm !== true) return decision
    if (!hasReadBack(planKey(exec.arguments))) return { kind: 'deny', reason: NO_READ_BACK }
    return { kind: 'ask', reason: planApprovalReason(exec.arguments) }
  })

  // A read-back that went through (confirm=false, no errors) is what a later confirm=true must match.
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (exec.name !== SAVE_TOOL || result.isError) return decision
    const value = record(result.value)
    const args = record(exec.arguments)
    if (args.confirm !== true && value.ok === true && value.saved === false) rememberReadBack(planKey(args))
    else if (args.confirm === true && value.saved === true) readBacks.delete(planKey(args))
    return decision
  })
}
