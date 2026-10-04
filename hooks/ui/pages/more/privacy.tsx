// 隐私与数据 (client/privacy/data-page.ts and consent-screen.ts): what is kept where and what goes to the model,
// the two separate consents, export, and deleting everything on this computer (behind a confirmation).
// In Claude Code the model is Claude: the route's copy names the web host's model, so it is said as Claude here.

import type { Ctx, Node } from '../../types.ts'
import { Buttons, C } from '../../kit.tsx'
import { NO_SAVE, archiveNote, saver } from './exports.tsx'
import { Bullets, Err, Note, Ok, Para, SubFold, Subhead } from './ui.tsx'
import type { Privacy } from './types.ts'
import { day, errorOf, flag, hostText, setSub, sub, toggleFlag } from './util.ts'

const SCOPE_ZH: Record<string, string> = {
  pipl_sensitive: '处理你的健康信息',
  data_flow_deepseek: '健康对话交给 Claude',
  study: '参加研究',
  session_log_upload: '上传会话日志',
}

const WITHDRAW_ZH: Record<string, string> = {
  pipl_sensitive: '撤回后，LongPi 不再读取你的指标，也不再交给模型。',
  data_flow_deepseek: '撤回后，回答你的问题时不再带上你的健康数值。',
  study: '撤回后，你的数据不再用于研究。',
  session_log_upload: '撤回后，不再上传会话日志。',
}

const ALL_AFTER_DELETE = ['privacy', 'self', 'meds', 'conditions', 'findings', 'memory', 'people', 'tracking', 'followup', 'stores']

function decisionText(decision: string | null | undefined): string {
  return decision === 'granted' ? '已同意' : decision === 'declined' ? '不同意' : decision === 'withdrawn' ? '已撤回' : '还没有选择'
}

export function privacySummary(ctx: Ctx): string {
  const status = ctx.json<Privacy>('privacy')
  if (!status) return ''
  const pipl = status.consents.pipl_sensitive?.decision
  const flow = status.consents.data_flow_deepseek?.decision
  return `健康信息：${decisionText(pipl)} · 交给 Claude：${decisionText(flow)}`
}

async function consent(ctx: Ctx, body: Record<string, unknown>, done: string): Promise<void> {
  setSub(ctx, 'privacy.error', '')
  setSub(ctx, 'privacy.note', '')
  const out = await ctx.act.post('privacy/consent', body, { reload: ['privacy'], done, quiet: true })
  if (!out.ok) setSub(ctx, 'privacy.error', errorOf(out.json, '保存失败'))
}

/** The two consents: handling health information (PIPL, separate), and handing health values to the model. */
function consents(ctx: Ctx, status: Privacy): Node[] {
  const E = ctx.E
  const { Box, Text } = E
  const copy = status.copy
  const pipl = status.consents.pipl_sensitive?.decision ?? null
  const flow = status.consents.data_flow_deepseek?.decision ?? null
  const child = status.minor?.child === true
  const showText = flag(ctx, 'privacy.pipl') || (pipl !== 'granted' && pipl !== 'declined')

  const grantPipl = async () => {
    let guardian = false
    if (child) {
      const answer = await ctx.act.ask(copy.minor?.under_14 ?? '未满 14 岁：处理健康信息还需家长（监护人）确认同意。', ['我是监护人，同意', '取消'], '监护人同意')
      if (answer !== '我是监护人，同意') return
      guardian = true
    }
    await consent(ctx, { scope: 'pipl_sensitive', decision: 'granted', ...(guardian ? { guardian: true } : {}) }, '已记录你的单独同意。')
  }
  /** Withdrawing any consent asks first; it can be given again any time. */
  const withdraw = async (scope: string, what: string) => {
    const answer = await ctx.act.ask(`撤回「${what}」的同意？${WITHDRAW_ZH[scope] ?? ''}以后可以随时重新同意。`, ['撤回', '取消'], '撤回同意')
    if (answer === '撤回') await consent(ctx, { scope, decision: 'withdrawn' }, '已撤回。')
  }

  const badge = (decision: string | null, key: string) => (
    <Text key={key} color={decision === 'granted' ? C.good : decision ? C.warn : C.dim}>{`[${decisionText(decision)}]`}</Text>
  )
  const state = (scope: string, key: string, extra: Node = null) => {
    const row = status.consents[scope]
    return (
      <Box key={key} flexDirection="row" gap={1}>
        {badge(row?.decision ?? null, `${key}-badge`)}
        {row?.at ? <Text dimColor>{day(ctx, row.at)}</Text> : null}
        {extra}
      </Box>
    )
  }
  const decided = (d: string | null) => d === 'granted' || d === 'declined' || d === 'withdrawn'
  // Consents given elsewhere (研究, the web host's session log): shown here only while granted, so they can be withdrawn.
  const others = (['study', 'session_log_upload'] as const).filter((scope) => status.consents[scope]?.decision === 'granted')

  return [
    Subhead(E, copy.pipl?.title ?? '单独同意：处理你的健康信息', 'pipl-head'),
    state('pipl_sensitive', 'pipl-state'),
    decided(pipl) ? SubFold(E, 'pipl-text', '同意书全文', showText, () => toggleFlag(ctx, 'privacy.pipl')) : null,
    showText ? Note(ctx, hostText(copy.pipl?.lead ?? '这一页是单独的一次同意。'), 'pipl-lead') : null,
    ...(showText ? (copy.pipl?.paragraphs ?? []).map((line, i) => Para(ctx, hostText(line), { key: `pipl-p${i}` })) : []),
    child && copy.minor?.under_14 ? Para(ctx, copy.minor.under_14, { key: 'pipl-child', color: C.warn }) : null,
    pipl === 'granted'
      ? Buttons(E, [{ key: 'pipl-withdraw', label: '撤回同意', onPress: () => { void withdraw('pipl_sensitive', SCOPE_ZH.pipl_sensitive as string) } }], 'pipl-buttons')
      : Buttons(E, [
        { key: 'pipl-grant', label: copy.buttons?.pipl_grant ?? '我单独同意处理我的健康信息', primary: true, onPress: () => { void grantPipl() } },
        ...(decided(pipl) ? [] : [{ key: 'pipl-decline', label: copy.buttons?.pipl_decline ?? '暂不同意', onPress: () => { void consent(ctx, { scope: 'pipl_sensitive', decision: 'declined' }, '已记录：暂不同意。') } }]),
      ], 'pipl-buttons'),

    Subhead(E, '健康对话交给 Claude', 'flow-head'),
    decided(flow) ? state('data_flow_deepseek', 'flow-state') : Note(ctx, '还没有选择。', 'flow-none'),
    flow === 'granted'
      ? Buttons(E, [{ key: 'flow-withdraw', label: '撤回同意', onPress: () => { void withdraw('data_flow_deepseek', SCOPE_ZH.data_flow_deepseek as string) } }], 'flow-buttons')
      : Buttons(E, [
        { key: 'flow-grant', label: hostText(copy.buttons?.flow_grant ?? '同意把健康对话发给 Claude'), primary: !decided(flow), onPress: () => { void consent(ctx, { scope: 'data_flow_deepseek', decision: 'granted' }, '已同意。') } },
        ...(decided(flow) ? [] : [{ key: 'flow-decline', label: copy.buttons?.flow_decline ?? '暂不发送', onPress: () => { void consent(ctx, { scope: 'data_flow_deepseek', decision: 'declined' }, '已记录：暂不发送。') } }]),
      ], 'flow-buttons'),

    ...others.flatMap((scope) => [
      Subhead(E, SCOPE_ZH[scope] as string, `${scope}-head`),
      state(scope, `${scope}-state`, Buttons(E, [{ key: `${scope}-withdraw`, label: '撤回同意', onPress: () => { void withdraw(scope, SCOPE_ZH[scope] as string) } }], `${scope}-buttons`)),
    ]),
  ]
}

/**
 * The whole privacy block. `withExport`: the settings page keeps the archive export here; the 档案 page has its own
 * 导出 section.
 */
export function PrivacySection(ctx: Ctx, opts: { withExport: boolean }): Node[] {
  const E = ctx.E
  const cached = ctx.route('privacy')
  const status = ctx.json<Privacy>('privacy')
  if (!status) {
    if (!cached || cached.loading) return [Note(ctx, '正在读取隐私说明…', 'privacy-loading')]
    return [Err(ctx, `未能读取隐私说明：${cached.error || '请稍后再试'}`, 'privacy-failed')]
  }
  const flow = status.copy.data_flow
  const phrase = status.delete?.phrase ?? status.copy.delete?.phrase ?? '删除全部'
  const note = status.delete?.note ?? status.copy.delete?.note ?? ''
  const minorLine = status.minor?.ask_age ? (status.copy.minor?.ask ?? '请填写年龄') : status.minor?.minor ? (status.copy.minor?.under_18 ?? '未满 18 岁') : ''
  // The web host's workspaces do not exist in Claude Code: that line is left out.
  const local = [...(flow?.stays_local ?? []).filter((line) => !/工作区/.test(line)), '体检和手环的数值也存在这台电脑上的健康记录里：你交给 Claude 的报告，读出的数值存在这里。']
  const write = saver(ctx)

  const remove = async () => {
    const answer = await ctx.act.ask(`${note || '会删除这台电脑上 LongPi 的档案、方案、记录、记忆和同意，不能恢复。'} 确定要删除吗？`, [phrase, '取消'], '删除数据')
    if (answer !== phrase) return
    setSub(ctx, 'privacy.error', '')
    const out = await ctx.act.post('privacy/delete', { confirm: phrase }, { reload: ALL_AFTER_DELETE, quiet: true })
    if (!out.ok) {
      setSub(ctx, 'privacy.error', `删除失败：${errorOf(out.json, '请稍后再试')}`)
      return
    }
    setSub(ctx, 'privacy.note', '已删除这台电脑上的 LongPi 档案')
    ctx.act.refresh()
  }

  return [
    Subhead(E, flow?.title ?? '数据去哪里', 'flow-title', '', false),
    Note(ctx, '发送给 Claude 的数据', 'flow-model-head'),
    Bullets(ctx, (flow?.to_deepseek ?? []).map(hostText), 'flow-model'),
    Note(ctx, '保存在这台电脑上的数据', 'flow-local-head'),
    Bullets(ctx, local, 'flow-local'),
    flow?.name && !(flow.to_deepseek ?? []).some((line) => /名字|称呼|姓名/.test(line)) ? Note(ctx, hostText(flow.name), 'flow-name') : null,
    ...consents(ctx, status),
    minorLine ? Note(ctx, minorLine, 'privacy-minor') : null,
    opts.withExport ? Subhead(E, '导出', 'privacy-export-head') : null,
    opts.withExport
      ? write && status.export?.href
        ? Buttons(E, [{ key: 'privacy-export', label: '下载这台电脑上的 LongPi 档案', onPress: () => {
          void write('privacy/export', `longpi-export-${ctx.today}.zip`).then((out) => setSub(ctx, 'privacy.note', out.ok ? `已保存到 ${out.path ?? ''}` : ''))
        } }], 'privacy-export-row')
        : Note(ctx, NO_SAVE, 'privacy-export-later')
      : null,
    opts.withExport && write ? Note(ctx, archiveNote(), 'privacy-export-note') : null,
    Subhead(E, '删除', 'privacy-delete-head'),
    Buttons(E, [{ key: 'privacy-delete', label: '删除这台电脑上的 LongPi 数据', onPress: () => { void remove() } }], 'privacy-delete-row'),
    note ? Note(ctx, note, 'privacy-delete-note') : null,
    Err(ctx, sub(ctx, 'privacy.error'), 'privacy-err'),
    Ok(ctx, sub(ctx, 'privacy.note'), 'privacy-ok'),
  ]
}
