// Tools for follow-up reminders the person opted into: change the settings
// (only on their word: turning reminders on, sending item names, or a webhook
// address waits for their approval in DSH), and send a message the model wrote
// through the same channels, for DSH scheduled follow-ups they agreed to.
// Never a dose, never inside quiet hours; with minimal detail, never a health
// value, a plan item or a marker name.

import type { Context } from '../sys/cordis.ts'
import { defineTool } from '../sys/dsh-tools.ts'
import type { Config } from './config.ts'
import { CN_NUMBER, hasDose } from './dose.ts'
import { bootEngage } from './engage/boot.ts'
import { followupResponse, inQuiet, maskUrl, readFollowup, sendNow, writeFollowup, WEBHOOK_KINDS, type FollowupState } from './followup.ts'
import { currentPlan } from './interventions.ts'
import { asJson } from './json.ts'
import { resolveDataDir, resolveRootDir, resolveSkillsHome } from './paths.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

const TEXT_MAX = 300
// A health value: a number with a clinical unit (mmHg, mmol/L, kg, cm, %, 岁…), in digits or Chinese numerals.
const HEALTH_VALUE = new RegExp(
  '\\d+(?:\\.\\d+)?\\s*(?:mmhg|mmol|umol|μmol|mg\\/|g\\/l|kg|公斤|千克|斤|cm|厘米|毫米汞柱|毫摩尔|微摩尔|%|个?百分点|岁|bpm|次\\s*[/每]\\s*分)'
  + `|${CN_NUMBER}\\s*(?:公斤|千克|斤|厘米|毫米汞柱|毫摩尔|微摩尔|个?百分点|岁)|百分之[零〇一二两三四五六七八九十\\d]`,
  'i',
)
// With minimal detail a number may only be a date, a clock time or a count of days, times or items.
const ALLOWED_NUMBERS = [
  /(?:19|20)\d{2}\s*[-/.年]\s*\d{1,2}(?:\s*[-/.月]\s*\d{1,2}\s*[日号]?)?/g,
  /\d{1,2}\s*月\s*\d{1,2}\s*[日号]?/g,
  /\d{1,2}\s*[:：]\s*\d{2}/g,
  /\d+\s*(?:个)?(?:天|次(?!\s*[/每])|项|条|周|星期|个月|分钟|小时|点(?!\s*\d))/g,
]
// A marker abbreviation followed by a number (LDL-C3.8, HbA1c 6.5): the lookbehind below lets HbA1c itself through.
const MARKER_NUMBER = /\b(?:ldl|hdl|tg|tc|crp|hs-?crp|sbp|dbp|bmi|hba1c|a1c|glu|fbg|fpg)(?:-?c)?\s*[:：=]?\s*\d/i
// A value in Chinese numerals: a decimal (六点八), or a number of tens or more (一百五, 七十五). A lone 一 or 两 is a
// word as often as a number (一直, 两次) and is not read as one.
const CN_VALUE = '(?:[零〇一二两三四五六七八九十百千万]+点[零〇一二两三四五六七八九]+|[零〇一二两三四五六七八九]*[十百千万][零〇一二两三四五六七八九十百千万]*)'
// After a health word, a single digit that ends the word is a value too (血糖七, 胆固醇是五); one that starts a word
// (一直, 一周) is not.
const CN_HEALTH_VALUE = `(?:${CN_VALUE}|(?<!第)[一二三四五六七八九](?![\\u4e00-\\u9fff]))`
// Words a health value follows (steps are not one). Up to eight more characters may name the marker in full
// (糖化血红蛋白, 空腹血糖, 低密度脂蛋白) before the number; a count (一百天, 十次) is not a value.
const HEALTH_WORD = '(?:血压|收缩压|舒张压|高压|低压|血糖|体重|腰围|心率|脉搏|胆固醇|甘油三酯|血脂|脂蛋白|糖化|血红蛋白|尿酸|肌酐|反应蛋白|ldl|hdl|hba1c|a1c|crp|bmi)'
// The whole number, never a part of it: 一百五十天 is a count, not 一百五 followed by 十天.
// A date (十月十日) and 十分 (very) are not values either.
const COUNT_AFTER = '(?![零〇一二两三四五六七八九十百千万点])(?!\\s*(?:个)?(?:天|次|项|条|周|星期|个月|月|日|号|年|分|小时|点钟|步|遍|岁))'
const HEALTH_CN = new RegExp(`${HEALTH_WORD}[^，,。.！!？?；;、\\n]{0,8}?${CN_HEALTH_VALUE}${COUNT_AFTER}`, 'i')
// Blood pressure as a/b in Chinese numerals: 一百五十/九十, 一百四比九十.
const CN_PRESSURE = new RegExp(`${CN_NUMBER}\\s*[/／比]\\s*${CN_NUMBER}`)

/**
 * The model's text is refused, with the reason, when it names a dose or, with minimal detail, a health
 * value, a number that is not a date, a time or a count, or one of `names` (the plan's item titles and
 * markers). Full-width digits and letters are read as their plain forms.
 */
export function followupTextProblem(text: string, detail: 'minimal' | 'full', names: readonly string[] = []): string {
  if (!text) return '没有内容。'
  if ([...text].length > TEXT_MAX) return `超过 ${TEXT_MAX} 字。`
  const plain = text.normalize('NFKC')
  if (hasDose(plain) || plain.includes('剂量')) return '随访消息不能包含剂量。'
  if (detail === 'full') return ''
  const numbers = ALLOWED_NUMBERS.reduce((rest, pattern) => rest.replace(pattern, ' '), plain)
  if (HEALTH_VALUE.test(plain) || MARKER_NUMBER.test(plain) || /(?<![A-Za-z])\d/.test(numbers) || HEALTH_CN.test(plain) || cnPressure(plain)) {
    return '随访设置为“简要”，消息里不能有健康数值（血压、血糖、血脂、体重、百分比等）；数字只能是日期、时间或天数、项数。'
  }
  const folded = plain.toLowerCase()
  const named = names.map((name) => name.normalize('NFKC').trim()).find((name) => [...name].length >= 2 && folded.includes(name.toLowerCase()))
  if (named) return `随访设置为“简要”，消息里不能出现方案项目或指标的名称（这次是「${named}」）；改成不含细节的提醒，例如“打开健康页查看”。`
  return ''
}

/** An a/b pair in Chinese numerals where both halves read as values (一百五十/九十), not a ratio of small counts (三比二). */
function cnPressure(text: string): boolean {
  const match = CN_PRESSURE.exec(text)
  if (!match) return false
  const [left, right] = match[0].split(/\s*[/／比]\s*/)
  const value = new RegExp(`^${CN_VALUE}$`)
  return value.test(left ?? '') || value.test(right ?? '')
}

/** Item titles and marker names of the current plan: what minimal detail keeps on this machine. */
function planNames(dataDir: string): string[] {
  const plan = currentPlan(dataDir)
  if (!plan) return []
  return [...new Set([...plan.items.flatMap((item) => [item.title, ...item.markers]), ...plan.goals.map((goal) => goal.marker)])]
}

/**
 * Why a set_followup call needs the person's own approval, or '' when it does not: turning reminders on,
 * sending item names and adherence (detail full), or any webhook address. The tool's text says "only on
 * their word"; this makes DSH ask them, so text the model read cannot switch it on alone.
 */
export function followupApprovalReason(args: unknown): string {
  const update = args && typeof args === 'object' && !Array.isArray(args) ? args as Record<string, unknown> : {}
  const parts: string[] = []
  if (update.enabled === true) parts.push('开启随访提醒')
  if (update.detail === 'full') parts.push('把提醒内容改为“完整”（项目名称、执行率会发出去）')
  const hook = update.webhook
  if (hook && typeof hook === 'object') {
    const url = typeof (hook as Record<string, unknown>).url === 'string' ? (hook as Record<string, unknown>).url as string : ''
    parts.push(url ? `把提醒发到 ${maskUrl(url)}` : '更改 Webhook 渠道')
  }
  return parts.length > 0 ? `LongPi 要${parts.join('、')}。只有你本人要求过才同意。` : ''
}

export function registerFollowupTools(ctx: Context, config: () => Config, state: () => Promise<FollowupState | null>): void {
  const dataDir = () => resolveDataDir(config().dataDir)
  try {
    bootEngage(ctx, {
      dataDir,
      rootDir: () => resolveRootDir(config().dataDir),
      skillsHome: () => resolveSkillsHome(config().skillsHome),
      codexOn: () => {
        const current = config() as { engage?: { codex?: boolean } }
        return current.engage?.codex !== false
      },
    })
  } catch { /* a host without tools still runs the rest of follow-up */ }

  // After every other listener allowed it: turning follow-up on, full detail or a webhook address needs the person's yes.
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    if (exec.name !== 'set_followup' || decision.kind !== 'allow') return decision
    const reason = followupApprovalReason(exec.arguments)
    return reason ? { kind: 'ask', reason } : decision
  })

  ctx.tools.register(defineTool({
    name: 'set_followup',
    description: 'Change follow-up reminders LongPi sends by itself while DeepSeek Harness runs: a check-in reminder at checkin_time when plan items are not ticked, a reminder at retest_time on retest days, a weekly summary, and one nudge when the first steps stall. Channels: a desktop notification and/or one webhook (feishu, wecom, dingtalk, bark, or generic: the person\'s own https endpoint). Pass only what the person just asked to change. Set enabled only when the person asked for follow-up (true) or to stop it (false). detail minimal (default) sends no health value or item name; full sends item names and adherence. Turning it on, detail full and a webhook ask the person to approve in DeepSeek Harness; if that is refused, point them to the settings page. Returns the settings (the webhook URL masked, the secret only as set or not) and the next planned times.',
    parameters: {
      enabled: { type: 'boolean', description: 'true only when the person asked for reminders; false when they want them off.' },
      checkin_time: { type: 'string', description: 'HH:MM local, default 21:00.' },
      retest_time: { type: 'string', description: 'HH:MM local, default 09:00.' },
      weekly: {
        oneOf: [
          { type: 'object', additionalProperties: false, properties: { day: { type: 'integer', description: 'ISO weekday: Monday 1 … Sunday 7.' }, time: { type: 'string', description: 'HH:MM.' } } },
          { type: 'null' },
        ],
        description: 'Weekly summary day and time (default Sunday 20:00); null turns it off.',
      },
      desktop: { type: 'boolean', description: 'Desktop notifications on this computer (macOS or Linux).' },
      webhook: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', enum: [...WEBHOOK_KINDS] },
              url: { type: 'string', description: 'The bot or push URL the person gave (https). Omit to keep the saved one.' },
              secret: { type: 'string', description: 'The signing secret they gave (Feishu, DingTalk). Omit to keep; empty string clears it.' },
            },
          },
          { type: 'null' },
        ],
        description: 'One webhook channel; null removes it.',
      },
      detail: { type: 'string', enum: ['minimal', 'full'], description: 'minimal: no health values or item names leave the machine (default). full: item names and adherence are sent.' },
      quiet: {
        oneOf: [
          { type: 'object', additionalProperties: false, properties: { start: { type: 'string' }, end: { type: 'string' } } },
          { type: 'null' },
        ],
        description: 'Quiet hours HH:MM–HH:MM (may wrap midnight, e.g. 22:30–08:00) with no sends; null for none.',
      },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const update = Object.fromEntries(Object.entries(args as Record<string, unknown>).filter(([, value]) => value !== undefined))
      const written = writeFollowup(dataDir(), update)
      if (!written.ok) return asJson({ ok: false, error: written.error })
      const response = followupResponse(dataDir(), await state().catch(() => null))
      return asJson({
        ok: true,
        settings: response.settings,
        next: response.next,
        platform_desktop: response.platform_desktop,
        note: 'Tell the person what will be sent, when and where, and that reminders go out only while DeepSeek Harness runs. The settings page (健康 → 随访提醒) has a test button.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'send_followup_message',
    description: 'Send one short follow-up message the person agreed to (for example from a DSH scheduled follow-up) through their follow-up channels. Only works when follow-up is on and outside the quiet hours; refused otherwise, and at most 6 messages a day in all. Never include a dose. With detail minimal (the default), include no health values (no blood pressure, glucose, lipid, weight or percent figures; numbers only as dates, times or counts of days or items) and no plan item or marker names: write a general encouragement and point to the 健康 page. A refused message says why; rewrite it and send once more. Chinese, at most 300 characters.',
    parameters: {
      text: { type: 'string', required: true, description: 'The message, at most 300 characters.' },
      kind: { type: 'string', enum: ['checkin', 'weekly', 'custom'], description: 'What it is about; default custom.' },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const settings = readFollowup(dataDir())
      if (!settings.enabled) {
        return asJson({ ok: false, error: '随访提醒没有打开。只有本人要求后，才用 set_followup 打开。', sent: false })
      }
      // The page's test button is the only send inside quiet hours.
      if (inQuiet(settings.quiet, new Date())) {
        return asJson({ ok: false, error: `现在是免打扰时段（${settings.quiet?.start}–${settings.quiet?.end}），没有发送。`, sent: false })
      }
      const text = typeof args.text === 'string' ? args.text.trim() : ''
      const problem = followupTextProblem(text, settings.detail, planNames(dataDir()))
      if (problem) return asJson({ ok: false, error: problem, sent: false })
      const kind = args.kind === 'checkin' || args.kind === 'weekly' ? args.kind : 'custom'
      const result = await sendNow(dataDir(), text, kind)
      return asJson({ ...result, sent: Object.keys(result.channels).length > 0 })
    },
  }))
}
