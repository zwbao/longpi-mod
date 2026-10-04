// 导出 (client/profile-tab.ts ExportCard) and the member file: the report to take to a doctor, Pi's member file,
// the calendar, and the whole archive. The pane cannot download; the engine writes the file when it offers
// `saveFile` (NEEDS.md), and until then the page says plainly that this step is still coming. Importing a member
// file is Claude's job (it reads the .md the person names), so the path goes into the prompt.

import type { Ctx, Node } from '../../types.ts'
import { Buttons } from '../../kit.tsx'
import { Bullets, Err, Field, Note, Ok, Subhead } from './ui.tsx'
import type { Memory, Privacy } from './types.ts'
import { setSub, sub } from './util.ts'

type SaveFile = (path: string, fileName: string) => Promise<{ ok: boolean; path?: string; error?: string }>

/** The engine's file writer, when this version has one. */
export function saver(ctx: Ctx): SaveFile | null {
  const fn = (ctx.act as unknown as { saveFile?: SaveFile }).saveFile
  return typeof fn === 'function' ? fn : null
}

export const NO_SAVE = '在这里还不能直接存成文件。想带给医生看，可以让 Claude 把报告整理出来。'

async function save(ctx: Ctx, path: string, fileName: string, what: string): Promise<void> {
  const write = saver(ctx)
  if (!write) return
  setSub(ctx, 'export.msg', '')
  const out = await write(path, fileName)
  setSub(ctx, 'export.msg', out.ok ? `${what}已保存到 ${out.path ?? fileName}` : `!${what}没有保存：${out.error || '请稍后再试'}`)
}

/** The archive note from the route, said for a record kept on this computer. */
export function archiveNote(): string {
  return '压缩包包含这台电脑上 LongPi 的档案、方案、记录、记忆和同意。'
}

export function ExportSection(ctx: Ctx, opts: { openPrivacy?: () => void }): Node[] {
  const E = ctx.E
  const today = ctx.today
  const privacy = ctx.json<Privacy>('privacy')
  const write = saver(ctx)
  const msg = sub(ctx, 'export.msg')
  return [
    Note(ctx, '报告汇总档案、记录里的变化、身体年龄和方案，可以带给医生看；会员档案是 Pi 记下的你的画面、小承诺和小胜利；日历文件包含复测日期和每天的打卡提醒。', 'export-what'),
    write
      ? Buttons(E, [
        { key: 'export-report', label: '导出报告', onPress: () => { void save(ctx, 'report', `longpi-report-${today}.md`, '报告') } },
        { key: 'export-member', label: '会员档案', onPress: () => { void save(ctx, 'member-file', `longpi-member-${today}.md`, '会员档案') } },
        { key: 'export-ics', label: '加入日历', onPress: () => { void save(ctx, 'calendar.ics', 'longpi.ics', '日历文件') } },
        ...(privacy?.export?.href ? [{ key: 'export-archive', label: '下载完整档案', onPress: () => { void save(ctx, 'privacy/export', `longpi-export-${today}.zip`, '完整档案') } }] : []),
      ], 'export-buttons')
      : Note(ctx, NO_SAVE, 'export-later'),
    write ? null : Buttons(E, [{ key: 'export-ask', label: '让 Claude 整理报告', onPress: () => ctx.act.fill('请把我的档案、记录里的变化、身体年龄和方案整理成一份可以带给医生看的报告。') }], 'export-ask-row'),
    msg.startsWith('!') ? Err(ctx, msg.slice(1), 'export-err') : Ok(ctx, msg, 'export-msg'),
    write ? Note(ctx, archiveNote(), 'export-note') : null,
    write ? Note(ctx, '导出的文件留在这台电脑上，LongPi 不会发给任何人。', 'export-local') : null,
    opts.openPrivacy ? Buttons(E, [{ key: 'export-privacy', label: '隐私与删除 ›', onPress: () => opts.openPrivacy?.() }], 'export-privacy-row') : null,
  ]
}

function pathProblem(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return '请粘贴会员档案的完整路径。'
  if (!trimmed.startsWith('/') && !trimmed.startsWith('~/')) return '路径要从 / 或 ~/ 开始，例如 ~/.longevity-coach/我.md。'
  if (!/\.md$/i.test(trimmed)) return '会员档案是 .md 文件。'
  return null
}

/** What the member file holds (medicines and conditions have their own sections). */
const MEMBER_KINDS: Record<string, string> = { motivation: '为什么在乎', vision: '想要的画面', style: '称呼和风格', note: '生活和偏好', life_event: '近期大事', commitment: '小承诺', win: '小胜利' }

function memberItems(memory: Memory | null): Array<{ label: string; text: string }> {
  return (memory?.items ?? [])
    .filter((item) => item.kind && MEMBER_KINDS[item.kind] && item.text_zh)
    .map((item) => ({ label: MEMBER_KINDS[item.kind as string] as string, text: item.text_zh as string }))
}

export function memberSummary(ctx: Ctx): string {
  const memory = ctx.json<Memory>('memory')
  if (!memory) return ''
  const n = memberItems(memory).length
  return n > 0 ? `Pi 记下了 ${n} 条` : 'Pi 还没有记下什么'
}

/** The member file: what Pi keeps, and bringing one in from the standalone coach. */
export function MemberSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const memory = ctx.json<Memory>('memory')
  const items = memberItems(memory)
  return [
    Note(ctx, items.length > 0 ? `会员档案是 Pi 记下的你的画面、小承诺和小胜利，现在有 ${items.length} 条。` : '会员档案是 Pi 记下的你的画面、小承诺和小胜利。聊得越多，记下的越多。', 'member-what'),
    Bullets(ctx, items.slice(0, 10).map((item) => `${item.label}：${item.text}`), 'member-items'),
    items.length > 10 ? Note(ctx, `另有 ${items.length - 10} 条`, 'member-more') : null,
    Subhead(E, '导入会员档案', 'member-import-head'),
    Note(ctx, '从独立版长寿教练带来的会员档案（.md 文件）可以读进来：为什么在乎、想要的画面、称呼和风格、近期大事、小承诺（原来的次数接着算）和小胜利。用药和测量表不导入。', 'member-import-what'),
    Field(ctx, {
      key: 'member-path', label: '文件路径', value: sub(ctx, 'member.path'), placeholder: '例如 ~/.longevity-coach/我.md', submitLabel: '交给 Claude',
      onSubmit: (value) => {
        const problem = pathProblem(value)
        setSub(ctx, 'member.path', value.trim())
        setSub(ctx, 'member.error', problem ?? '')
        if (!problem) ctx.act.fill(`请帮我导入这份会员档案：${value.trim()}`)
      },
    }),
    Err(ctx, sub(ctx, 'member.error'), 'member-err'),
    Note(ctx, '按回车后，这句话会放进对话框，确认后发给 Claude。', 'member-how'),
  ]
}
