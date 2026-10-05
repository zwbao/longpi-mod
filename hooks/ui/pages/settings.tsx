// The 设置 page (client/settings-page.ts): the things changed once in a while. 提醒 (one switch and its time, the
// rest under 更多设置), 数据连接, 一起研究 (one switch), 隐私与数据 (where things live, what goes to the model,
// the consents, export and delete), the screen's numbers (演示模式, 显示 60 秒), the model and its use today,
// and 高级：方法库. One line per section when closed; any number open at once.

import type { Ctx, Node, Page } from '../types.ts'
import { Buttons, C, bar, num, pad } from '../kit.tsx'
import { RecordSection, recordLine } from './more/connection.tsx'
import { NO_SAVE, saver } from './more/exports.tsx'
import { FollowupSection, followupSummary } from './more/followup.tsx'
import { METHOD_ROUTES, MethodsSection, matchRoute } from './more/methods.tsx'
import { PrivacySection, privacySummary } from './more/privacy.tsx'
import { Body, Err, Fold, Note, Ok, Row, SubFold, Switch } from './more/ui.tsx'
import type { Journey } from './more/types.ts'
import { flag, setSub, sub, toggleFlag } from './more/util.ts'

const PAGE = 'settings'

type Invite = { ok: boolean; show: boolean; mode: string; intro_zh: string; waiting_zh: string; preference: string; user_set: boolean }
type Usage = {
  today?: { input: number; output: number; calls: number; spawns: number }
  remaining?: { input: number; output: number; spawns: number }
  caps?: { dailyInputTokens: number; dailyOutputTokens: number; maxSpawnsPerDay: number }
}

// --- 一起研究 ------------------------------------------------------------------------------------------

/** Joined only after the person pressed 加入: the default preference is not a choice they made. */
function scienceOn(invite: Invite | null): boolean {
  return Boolean((invite as { user_set?: boolean } | null)?.user_set) && !(invite?.preference === 'off' || invite?.mode === 'off')
}

function Science(ctx: Ctx): Node[] {
  const E = ctx.E
  const invite = ctx.json<Invite>('science/invite')
  const on = scienceOn(invite)
  const set = async (next: boolean) => {
    setSub(ctx, 'sci.error', '')
    const out = await ctx.act.post('science/preference', { mode: next ? 'local' : 'off' }, { reload: ['science/invite'], done: next ? '已开启。' : '已关闭。', quiet: true })
    if (!out.ok) setSub(ctx, 'sci.error', '保存失败，请稍后再试。')
  }
  const later = async () => {
    await ctx.act.post('science/invite', { decision: 'later' }, { reload: ['science/invite'], quiet: true })
    setSub(ctx, 'sci.note', '已暂缓。这台电脑上的功能仍可使用。')
  }
  return [
    Switch(E, 'sci-on', on, '在这台电脑上参与研究', (next) => { void set(next) }),
    Note(ctx, '开启后，可使用研究页、个人对照和本地统计，数据仅保存在这台电脑上。关闭后以上功能停止。未满 18 岁时始终关闭。', 'sci-text'),
    invite?.show && on ? Note(ctx, invite.intro_zh, 'sci-intro') : null,
    invite?.waiting_zh ? Note(ctx, invite.waiting_zh, 'sci-waiting') : null,
    Err(ctx, sub(ctx, 'sci.error'), 'sci-err'),
    Ok(ctx, sub(ctx, 'sci.note'), 'sci-note'),
    Buttons(E, [
      { key: 'sci-open', label: '打开研究页 ›', onPress: () => ctx.act.go('science') },
      ...(invite?.show ? [{ key: 'sci-later', label: '以后再说', onPress: () => { void later() } }] : []),
    ], 'sci-buttons'),
  ]
}

// --- 隐私与数据 ------------------------------------------------------------------------------------------

function Privacy(ctx: Ctx): Node[] {
  const E = ctx.E
  const open = flag(ctx, 'set.privacy.more')
  const write = saver(ctx)
  const report = async () => {
    if (!write) return
    const out = await write('report', `longpi-report-${ctx.today}.md`)
    setSub(ctx, 'set.report', out.ok ? `报告已保存到 ${out.path ?? ''}` : `!报告没有保存：${out.error || '请稍后再试'}`)
  }
  const msg = sub(ctx, 'set.report')
  return [
    Row(ctx, '存储位置', '档案、方案、记录、自测和提醒，连同体检和手环的数值，都只保存在这台电脑上（~/.longpi）。', { key: 'priv-where' }),
    Row(ctx, '交给模型的', '和 Claude 对话时，经你同意，你的问题以及回答所需的档案和化验数据才会交给 Claude。不对话则不发送。', { key: 'priv-model' }),
    Row(ctx, '发送到手机', '默认关闭，仅在你自行配置后发送。默认不含项目名称和健康数值；选择「详细」后会带上项目名称、执行率和复测指标。', { key: 'priv-phone' }),
    write
      ? Buttons(E, [{ key: 'priv-report', label: '导出报告', onPress: () => { void report() } }], 'priv-report-row')
      : Buttons(E, [{ key: 'priv-report-ask', label: '让 Claude 整理报告', onPress: () => ctx.act.fill('请把我的档案、记录里的变化、身体年龄和方案整理成一份可以带给医生看的报告。') }], 'priv-report-row'),
    write ? null : Note(ctx, NO_SAVE, 'priv-report-later'),
    msg.startsWith('!') ? Err(ctx, msg.slice(1), 'priv-report-err') : Ok(ctx, msg, 'priv-report-msg'),
    SubFold(E, 'priv-more', '数据去哪里、同意、导出和删除', open, () => toggleFlag(ctx, 'set.privacy.more')),
    ...(open ? PrivacySection(ctx, { withExport: true }) : []),
  ]
}

// --- 屏幕上的数字 -----------------------------------------------------------------------------------------

function displaySummary(ctx: Ctx): string {
  if (ctx.privacy.presentation) return '演示模式：已打开'
  if (ctx.privacy.shown) return '数字显示中，1 分钟内自动折起'
  return '对话框上方的数字已折起'
}

function Display(ctx: Ctx): Node[] {
  const E = ctx.E
  const p = ctx.privacy
  return [
    Switch(E, 'disp-present', p.presentation, '演示模式', (on) => {
      ctx.act.setPresentation(on)
      ctx.act.toast(on ? '演示模式已打开：LongPi 不再显示个人数字和提醒。' : '演示模式已关闭。')
    }),
    Note(ctx, '给别人看屏幕、投影或录屏时打开：LongPi 不再显示个人数字和提醒，直到你关掉它。也可以在对话框输入 /longpi 演示模式。', 'disp-present-note'),
    Buttons(E, [{
      key: 'disp-reveal', label: p.shown ? '数字显示中（1 分钟内自动折起）' : '显示数字 60 秒',
      ...(p.presentation ? { dim: true } : {}),
      onPress: () => {
        if (p.presentation) {
          ctx.act.toast('演示模式开着，先关掉演示模式。')
          return
        }
        ctx.act.reveal()
      },
    }], 'disp-reveal-row'),
    Note(ctx, '对话框上方的提示条和对话里的卡片，默认把你的数字折成 ••；按一下显示 60 秒，之后自动折起。这一页和健康页里的数字照常显示。', 'disp-reveal-note'),
  ]
}

// --- 模型与用量 ------------------------------------------------------------------------------------------

function usageSummary(ctx: Ctx): string {
  const usage = ctx.json<Usage>('usage')
  if (!usage?.today) return ''
  return `今天后台用了 ${usage.today.calls} 次`
}

function Model(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Box, Text } = E
  const usage = ctx.json<Usage>('usage')
  const today = usage?.today
  const caps = usage?.caps
  /** What is left of a daily allowance, as a bar and a plain percentage. */
  const meter = (label: string, used: number, cap: number, key: string) => {
    const left = cap > 0 ? Math.max(0, 1 - used / cap) : 0
    return (
      <Box key={key} flexDirection="row" gap={1}>
        <Text dimColor>{pad(label, 10)}</Text>
        <Text color={left <= 0.1 ? C.warn : C.accent}>{bar(left, 16)}</Text>
        <Text>{`还剩 ${num(left * 100, 0)}%`}</Text>
      </Box>
    )
  }
  return [
    Note(ctx, '回答你的是 Claude，就是你正在对话的这一个。LongPi 在后台整理数据、读报告、做深度分析时也会用到模型，每天有上限，用完了第二天再继续。', 'model-what'),
    today && caps
      ? (
        <Box key="model-usage" flexDirection="column">
          <Text>{`今天后台调用 ${today.calls} 次，深度分析 ${today.spawns} 次（每天最多 ${caps.maxSpawnsPerDay} 次）`}</Text>
          {meter('读入额度', today.input, caps.dailyInputTokens, 'model-in')}
          {meter('写出额度', today.output, caps.dailyOutputTokens, 'model-out')}
        </Box>
      )
      : Note(ctx, ctx.route('usage')?.loading === false ? '没有读到今天的用量。' : '正在读取…', 'model-usage-none'),
  ]
}

// --- the page ------------------------------------------------------------------------------------------

function draw(ctx: Ctx): Node {
  const { Box } = ctx.E
  const journey = ctx.json<Journey>('journey')
  const version = ctx.json<{ version?: string }>('version')?.version ?? journey?.version ?? ''

  const sections: Array<{ id: string; title: string; summary: string; body: () => Node[]; tone?: string }> = [
    { id: 'followup', title: '提醒', summary: followupSummary(ctx), body: () => FollowupSection(ctx) },
    ...(journey ? [{ id: 'record', title: '健康记录', summary: recordLine(journey), body: () => RecordSection(ctx, journey, 'settings') }] : []),
    { id: 'science', title: '一起研究', summary: ctx.json('science/invite') ? (scienceOn(ctx.json<Invite>('science/invite')) ? '已加入：只在这台电脑上' : (ctx.json<{ user_set?: boolean }>('science/invite')?.user_set ? '已关闭' : '未加入')) : '', body: () => Science(ctx) },
    { id: 'privacy', title: '隐私与数据', summary: privacySummary(ctx), body: () => Privacy(ctx) },
    { id: 'display', title: '屏幕上的数字', summary: displaySummary(ctx), body: () => Display(ctx), ...(ctx.privacy.presentation ? { tone: C.warn } : {}) },
    { id: 'model', title: '模型与用量', summary: usageSummary(ctx), body: () => Model(ctx) },
    { id: 'methods', title: '高级：方法库和安装细节', summary: '', body: () => MethodsSection(ctx) },
  ]
  return (
    <Box flexDirection="column">
      {sections.flatMap((section) => {
        const fold = Fold(ctx, { page: PAGE, id: section.id, title: section.title, summary: section.summary, fallback: 'followup', ...(section.tone ? { tone: section.tone } : {}) })
        return [fold.head, fold.open ? Body(ctx, section.id, section.body()) : null]
      })}
      {version ? <Box key="version" marginTop={1}>{Note(ctx, `LongPi ${version}（Claude Code 版）`, 'version-t', ctx.width)}</Box> : null}
    </Box>
  )
}

export const page: Page = {
  tab: 'settings',
  label: '设置',
  routes: (view) => {
    const methods = view.sub[`more.${PAGE}.open.methods`] === '1'
    const match = methods ? matchRoute({ view }) : null
    return ['followup', 'privacy', 'usage', 'version', 'science/invite', ...(methods ? METHOD_ROUTES : []), ...(match ? [match] : [])]
  },
  draw,
}

