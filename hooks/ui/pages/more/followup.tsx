// 提醒 (client/followup.ts): LongPi's own follow-up, sent while Claude Code runs. Off until the person turns it on.
// Most people need one switch, 每晚提醒我打卡, and its time; the rest (retest, weekly, quiet hours, channels,
// detail) waits under 更多设置. In the pane each setting saves on its own (the route takes any subset); webhook
// addresses and secrets never come back in full, and an empty field keeps what is stored.

import type { Ctx, Node } from '../../types.ts'
import { Buttons, C, fit } from '../../kit.tsx'
import { Choice, Err, Field, Note, Ok, Pick, Row, SubFold, Subhead, Switch } from './ui.tsx'
import type { Followup, FollowupKind, FollowupLogRow, FollowupSettings, WebhookKind } from './types.ts'
import { errorOf, flag, setSub, sub, timeOf, toggleFlag, whenText } from './util.ts'

export const FOLLOWUP_NOTE = '提醒只在 Claude Code 开着时发送；详细模式会把方案名称和数值发到你配置的渠道。'
/** The core's FOLLOWUP_MAX_PER_DAY: every kind counts, tests and failed sends too. */
const MAX_PER_DAY = 6

const KIND_ZH: Record<WebhookKind, string> = { feishu: '飞书', wecom: '企业微信', dingtalk: '钉钉', bark: 'Bark', generic: '通用 Webhook' }
const KIND_URL: Record<WebhookKind, string> = {
  feishu: 'https://open.feishu.cn/open-apis/bot/v2/hook/…',
  wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…',
  dingtalk: 'https://oapi.dingtalk.com/robot/send?access_token=…',
  bark: 'https://api.day.app/你的 key',
  generic: 'https://…（局域网内可用 http://）',
}
/** Kinds whose robots sign requests with a shared secret. */
const SIGNED: WebhookKind[] = ['feishu', 'dingtalk']
const LOG_ZH: Record<FollowupKind, string> = { checkin: '打卡提醒', retest: '复测提醒', weekly: '每周小结', nudge: '进度提醒', custom: 'AI 随访', test: '测试' }
const DAYS = ['每周一', '每周二', '每周三', '每周四', '每周五', '每周六', '每周日']

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/** A time in the part of a quiet window that runs to midnight is never sent (the server refuses it too). */
function lostInQuiet(s: FollowupSettings): string | null {
  if (!s.quiet || s.quiet.start <= s.quiet.end) return null
  const start = minutesOf(s.quiet.start)
  const times: Array<[string, string]> = [['打卡提醒', s.checkin_time], ['复测提醒', s.retest_time]]
  if (s.weekly) times.push(['每周小结', s.weekly.time])
  const hit = times.find(([, time]) => minutesOf(time) >= start)
  return hit ? `${hit[0]}的时间 ${hit[1]} 处于免打扰时段（${s.quiet.start}–${s.quiet.end}）中午夜之前的部分，当天将无法发送；请调整时间或免打扰时段。` : null
}

function hasChannel(data: Followup): boolean {
  return (data.settings.desktop && data.platform_desktop) || data.settings.webhook != null
}

async function save(ctx: Ctx, data: Followup, body: Record<string, unknown>, done: string): Promise<boolean> {
  setSub(ctx, 'fu.error', '')
  const next = { ...data.settings, ...body } as FollowupSettings
  const problem = lostInQuiet(next)
  if (problem) {
    setSub(ctx, 'fu.error', problem)
    return false
  }
  const out = await ctx.act.post('followup', body, { reload: ['followup'], done, quiet: true })
  if (!out.ok) setSub(ctx, 'fu.error', `保存失败：${errorOf(out.json, '请稍后再试')}`)
  return out.ok
}

function nextParts(ctx: Ctx, data: Followup): Array<[string, string]> {
  const parts: Array<[string, string | null]> = [['下次打卡', data.next.checkin], ['下次复测', data.next.retest], ['下次小结', data.next.weekly]]
  return parts.filter((row): row is [string, string] => Boolean(row[1])).map(([label, iso]) => [label, whenText(ctx, iso)])
}

/** "当天有未完成的打卡时，21:00 通过桌面通知提醒；不含健康数值。": what the switch does, from what is stored. */
function switchCaption(data: Followup): string {
  const s = data.settings
  const channels = [s.desktop && data.platform_desktop ? '桌面通知' : '', s.webhook ? '手机（Webhook）' : ''].filter(Boolean)
  const where = channels.length > 0 ? channels.join('和') : data.platform_desktop ? '桌面通知' : '（暂无可用渠道，请在「更多设置」中填写 Webhook）'
  const what = s.detail === 'minimal' ? '不含健康数值' : '含方案项目名称和执行率'
  return `当天有未完成的打卡时，${s.checkin_time} 通过${where}提醒；${what}。`
}

/** One line for the closed fold. */
export function followupSummary(ctx: Ctx): string {
  const data = ctx.json<Followup>('followup')
  if (!data) return ''
  if (!data.settings.enabled) return '已关闭'
  if (!hasChannel(data)) return '已开启，但暂无可用渠道'
  return `每晚 ${data.settings.checkin_time} 提醒打卡`
}

function channelsText(row: FollowupLogRow): string {
  const out: string[] = []
  if (row.channels.desktop != null) out.push(`桌面${row.channels.desktop ? '' : ' 失败'}`)
  if (row.channels.webhook != null) out.push(`Webhook${row.channels.webhook ? '' : ' 失败'}`)
  return out.join('、')
}

function log(ctx: Ctx, rows: readonly FollowupLogRow[]): Node[] {
  const { Box, Text } = ctx.E
  const shown = [...rows].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)
  return [
    Subhead(ctx.E, '最近发送', 'fu-log-head', shown.length > 0 ? `最近 ${shown.length} 条` : ''),
    ...(shown.length === 0
      ? [Note(ctx, '还没有发过提醒。', 'fu-log-none')]
      : shown.map((row, i) => {
        const badge = row.ok ? '✓ 已发送' : Object.values(row.channels).some(Boolean) ? '✗ 部分失败' : '✗ 失败'
        return (
          <Box key={`fu-log-${i}`} flexDirection="row" justifyContent="space-between" width={ctx.width - 2}>
            <Text wrap="truncate-end">{`${whenText(ctx, row.at)}  ${LOG_ZH[row.kind] ?? row.kind}${row.error ? `  ${fit(row.error, 30)}` : ''}`}</Text>
            <Box flexDirection="row" gap={1}>
              {channelsText(row) ? <Text dimColor>{channelsText(row)}</Text> : null}
              <Text color={row.ok ? C.good : C.warn}>{badge}</Text>
            </Box>
          </Box>
        )
      })),
  ]
}

/** The whole form under 更多设置. */
function more(ctx: Ctx, data: Followup): Node[] {
  const E = ctx.E
  const s = data.settings
  const stored = s.webhook?.kind ?? ''
  const kind = (sub(ctx, 'fu.kind') || stored) as WebhookKind | ''
  const draftNone = sub(ctx, 'fu.kind') === 'none'
  const shownKind: WebhookKind | '' = draftNone ? '' : kind
  const storedSame = shownKind !== '' && stored === shownKind

  const time = (key: 'checkin_time' | 'retest_time', label: string, hint: string) => Field(ctx, {
    key: `fu-${key}`, label, value: s[key], placeholder: s[key], hint,
    onSubmit: (text) => {
      const t = timeOf(text)
      if (!t) return setSub(ctx, 'fu.error', `${label}的时间请写成 21:00 这样。`)
      if (t !== s[key]) void save(ctx, data, { [key]: t }, `${label}改为 ${t}。`)
    },
  })

  const pickKind = async (value: string) => {
    if (value === '') {
      if (!s.webhook) return setSub(ctx, 'fu.kind', '')
      const answer = await ctx.act.ask(`不再发到${KIND_ZH[s.webhook.kind]}？保存的地址和密钥会一起删除。`, ['不再发送', '取消'], '提醒渠道')
      if (answer !== '不再发送') return
      if (await save(ctx, data, { webhook: null }, '已停用 Webhook。')) setSub(ctx, 'fu.kind', '')
      return
    }
    setSub(ctx, 'fu.kind', value === stored ? '' : value)
  }
  const saveUrl = (text: string) => {
    if (!shownKind) return
    const url = text.trim()
    setSub(ctx, 'fu.url', url)
    if (!url) return
    if (!/^https?:\/\//i.test(url)) return setSub(ctx, 'fu.error', 'Webhook 地址要以 https:// 开头。')
    if (/^http:\/\//i.test(url) && shownKind !== 'generic') return setSub(ctx, 'fu.error', `${KIND_ZH[shownKind]}的地址要用 https://。`)
    void save(ctx, data, { webhook: { kind: shownKind, url } }, `已保存${KIND_ZH[shownKind]}的地址。`).then((ok) => {
      if (!ok) return
      setSub(ctx, 'fu.kind', '')
      setSub(ctx, 'fu.url', '')
    })
  }
  const saveSecret = (text: string) => {
    if (!shownKind || !text) return
    if (text.length > 200) return setSub(ctx, 'fu.error', '签名密钥太长（最多 200 个字符）。')
    if (!storedSame) return setSub(ctx, 'fu.error', `请先填写${KIND_ZH[shownKind]}的 Webhook 地址。`)
    void save(ctx, data, { webhook: { kind: shownKind, secret: text } }, '签名密钥已保存。')
  }

  const weeklyDay = s.weekly ? String(s.weekly.day) : '0'
  const test = sub(ctx, 'fu.test')

  return [
    Subhead(E, '什么时候', 'fu-when', '', false),
    time('checkin_time', '打卡提醒', '当天还有未完成时'),
    time('retest_time', '复测提醒', '到期当天'),
    Pick(ctx, {
      key: 'fu-weekly-day', label: '每周小结',
      options: [{ value: '0', label: '不发送' }, ...DAYS.map((label, i) => ({ value: String(i + 1), label }))],
      value: weeklyDay,
      onSelect: (value) => {
        if (value === weeklyDay) return
        void save(ctx, data, { weekly: value === '0' ? null : { day: Number(value), time: s.weekly?.time ?? '20:00' } }, value === '0' ? '每周小结已关闭。' : `每周小结改在${DAYS[Number(value) - 1]}。`)
      },
    }),
    s.weekly ? Field(ctx, {
      key: 'fu-weekly-time', label: '小结时间', value: s.weekly.time, placeholder: s.weekly.time,
      onSubmit: (text) => {
        const t = timeOf(text)
        if (!t) return setSub(ctx, 'fu.error', '每周小结的时间请写成 20:00 这样。')
        if (t !== s.weekly?.time) void save(ctx, data, { weekly: { day: s.weekly?.day ?? 7, time: t } }, `每周小结改为 ${t}。`)
      },
    }) : null,
    Switch(E, 'fu-quiet', s.quiet != null, '免打扰时段', (on) => { void save(ctx, data, { quiet: on ? { start: '22:30', end: '08:00' } : null }, on ? '免打扰已开启（22:30 至 08:00）。' : '免打扰已关闭。') }),
    s.quiet ? Field(ctx, {
      key: 'fu-quiet-start', label: '从', value: s.quiet.start, placeholder: s.quiet.start,
      onSubmit: (text) => {
        const t = timeOf(text)
        if (!t) return setSub(ctx, 'fu.error', '免打扰的开始时间请写成 22:30 这样。')
        if (t === s.quiet?.end) return setSub(ctx, 'fu.error', '免打扰的开始和结束不能是同一时间。')
        if (t !== s.quiet?.start) void save(ctx, data, { quiet: { start: t, end: s.quiet?.end ?? '08:00' } }, `免打扰从 ${t} 开始。`)
      },
    }) : null,
    s.quiet ? Field(ctx, {
      key: 'fu-quiet-end', label: '至', value: s.quiet.end, placeholder: s.quiet.end,
      onSubmit: (text) => {
        const t = timeOf(text)
        if (!t) return setSub(ctx, 'fu.error', '免打扰的结束时间请写成 08:00 这样。')
        if (t === s.quiet?.start) return setSub(ctx, 'fu.error', '免打扰的开始和结束不能是同一时间。')
        if (t !== s.quiet?.end) void save(ctx, data, { quiet: { start: s.quiet?.start ?? '22:30', end: t } }, `免打扰到 ${t} 结束。`)
      },
    }) : null,

    Subhead(E, '发到哪里', 'fu-where'),
    data.platform_desktop
      ? Switch(E, 'fu-desktop', s.desktop, '桌面通知：这台电脑的系统通知', (on) => { void save(ctx, data, { desktop: on }, on ? '桌面通知已开启。' : '桌面通知已关闭。') })
      : Note(ctx, '桌面通知：这台电脑的系统不支持', 'fu-desktop-none'),
    Pick(ctx, {
      key: 'fu-kind', label: 'Webhook 渠道',
      options: [{ value: '', label: '不使用' }, ...(Object.keys(KIND_ZH) as WebhookKind[]).map((key) => ({ value: key, label: KIND_ZH[key] }))],
      value: shownKind,
      onSelect: (value) => { void pickKind(value) },
    }),
    Note(ctx, '选填：发送到手机上的群机器人或 App。', 'fu-kind-note'),
    shownKind ? Row(ctx, '', storedSame ? `已设置：${s.webhook?.url_masked ?? ''}` : '还没有填写地址', { key: 'fu-url-state', dim: true }) : null,
    shownKind ? Field(ctx, { key: 'fu-url', label: '地址', value: sub(ctx, 'fu.url'), placeholder: storedSame ? '留空保持不变；填写则替换' : KIND_URL[shownKind], onSubmit: saveUrl }) : null,
    shownKind && SIGNED.includes(shownKind) ? Field(ctx, {
      key: 'fu-secret', label: '签名密钥', hint: '仅在机器人开启「加签」时需要',
      placeholder: storedSame && s.webhook?.secret_set ? '已设置（留空保持不变）' : '选填',
      onSubmit: saveSecret,
    }) : null,
    storedSame && s.webhook?.secret_set && SIGNED.includes(shownKind as WebhookKind)
      ? Buttons(E, [{ key: 'fu-secret-clear', label: '清除签名密钥', onPress: () => { void save(ctx, data, { webhook: { kind: shownKind, secret: '' } }, '签名密钥已清除。') } }], 'fu-secret-row')
      : null,

    Err(ctx, sub(ctx, 'fu.error'), 'fu-err2'),
    Subhead(E, '内容', 'fu-detail-head'),
    Choice(E, 'fu-detail', [{ value: 'minimal', label: '简要：不含健康数值' }, { value: 'full', label: '详细' }] as const, s.detail, (value) => {
      if (value !== s.detail) void save(ctx, data, { detail: value }, value === 'minimal' ? '改为简要。' : '改为详细。')
    }),
    Note(ctx, s.detail === 'minimal' ? '只发「今天还有 2 项待打卡」这类提示，不含项目名称和健康数值。' : '会带上方案项目名称、执行率和复测指标，发到你配置的渠道。', 'fu-detail-note'),

    Buttons(E, [{
      key: 'fu-test', label: sub(ctx, 'fu.testing') ? '发送中…' : '发送测试',
      onPress: () => {
        if (sub(ctx, 'fu.testing')) return
        setSub(ctx, 'fu.testing', '1')
        setSub(ctx, 'fu.test', '')
        void ctx.act.post('followup/test', {}, { reload: ['followup'], quiet: true }).then((out) => {
          setSub(ctx, 'fu.testing', '')
          const channels = (out.json.channels ?? {}) as { desktop?: { ok: boolean; error?: string }; webhook?: { ok: boolean; error?: string } }
          const rows: string[] = []
          if (channels.desktop) rows.push(`${channels.desktop.ok ? '✓' : '✗'} 桌面通知：${channels.desktop.ok ? '已发送' : `失败${channels.desktop.error ? `（${channels.desktop.error}）` : ''}`}`)
          if (channels.webhook) rows.push(`${channels.webhook.ok ? '✓' : '✗'} ${s.webhook ? KIND_ZH[s.webhook.kind] : 'Webhook'}：${channels.webhook.ok ? '已发送' : `失败${channels.webhook.error ? `（${channels.webhook.error}）` : ''}`}`)
          const text = rows.length > 0 ? rows.join('  ') : typeof out.json.error === 'string' ? out.json.error : '没有可用的渠道：请开启桌面通知或填写 Webhook 后重试。'
          setSub(ctx, 'fu.test', `${rows.length > 0 && rows.every((row) => row.startsWith('✓')) ? '' : '!'}${text}`)
        })
      },
    }], 'fu-test-row'),
    test.startsWith('!') ? Err(ctx, test.slice(1), 'fu-test-result') : Ok(ctx, test, 'fu-test-result'),
    Note(ctx, `${FOLLOWUP_NOTE}每天最多发送 ${MAX_PER_DAY} 条（测试也算在内）。`, 'fu-fine'),
    ...log(ctx, data.log),
  ]
}

/** 提醒 on the settings page: the switch, then 更多设置 with the whole form and the log. */
export function FollowupSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Box } = E
  const cached = ctx.route('followup')
  const data = ctx.json<Followup>('followup')
  if (!data) {
    if (!cached || cached.loading) return [Note(ctx, '正在读取提醒设置…', 'fu-loading')]
    return [Err(ctx, `提醒设置没有读到：${cached.error || '请稍后再试'}`, 'fu-failed'), Buttons(E, [{ key: 'fu-retry', label: '重试', onPress: () => ctx.act.load(['followup'], true) }], 'fu-retry-row')]
  }
  const s = data.settings
  const open = flag(ctx, 'fu.more')
  const next = s.enabled && hasChannel(data) ? nextParts(ctx, data) : []
  return [
    Note(ctx, '默认关闭。关掉 Claude Code 后不会发送提醒。', 'fu-hint'),
    Switch(E, 'fu-on', s.enabled, '每晚提醒我打卡', (on) => { void save(ctx, data, on ? { enabled: true, ...(hasChannel(data) ? {} : { desktop: true }) } : { enabled: false }, on ? '打卡提醒已开启。' : '提醒已关闭。') }),
    Field(ctx, {
      key: 'fu-time', label: '提醒时间', value: s.checkin_time, placeholder: s.checkin_time,
      onSubmit: (text) => {
        const t = timeOf(text)
        if (!t) return setSub(ctx, 'fu.error', '提醒时间请写成 21:00 这样。')
        if (t !== s.checkin_time) void save(ctx, data, { checkin_time: t }, `提醒时间改为 ${t}。`)
      },
    }),
    Note(ctx, s.enabled ? switchCaption(data) : `关闭时不会发送提醒。开启后：${switchCaption(data)}`, 'fu-caption'),
    s.enabled && !hasChannel(data) ? Err(ctx, '已开启，但暂无可用渠道：请开启桌面通知或填写 Webhook。', 'fu-no-channel') : null,
    s.enabled && hasChannel(data)
      ? next.length === 0
        ? Note(ctx, '近期没有要发的提醒。', 'fu-next-none')
        : (
          <Box key="fu-next" flexDirection="column">
            {next.map(([label, when]) => Row(ctx, label, when, { key: `fu-next-${label}` }))}
          </Box>
        )
      : null,
    open ? null : Err(ctx, sub(ctx, 'fu.error'), 'fu-err'),
    Note(ctx, '长寿图鉴不另外发送提醒。', 'fu-codex'),
    SubFold(E, 'fu-more', '更多设置', open, () => toggleFlag(ctx, 'fu.more'), '复测提醒、每周小结、免打扰、发送到飞书或手机、内容详略'),
    ...(open ? more(ctx, data) : []),
  ]
}

