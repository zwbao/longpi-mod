// The coach's member file (longevity-coach templates/member.md), both ways. LongPi's own data is the record: the file
// is rendered from it for the person to read and keep, and a file brought from the standalone coach is read into
// LongPi's memory once. Medicines and measurements in such a file are not imported: those are confirmed in person or
// measured again, so nothing safety-relevant comes in on a file's say-so.

import type { Context } from '../sys/cordis.ts'
import { defineTool } from '../sys/dsh-tools.ts'
import { lstatSync, readFileSync } from '../sys/fs.ts'
import { homedir } from '../sys/os.ts'
import { extname, isAbsolute, join, resolve } from '../sys/path.ts'
import { memberIdFor } from './analysis/service.ts'
import { currentImport, doctorItems } from './analysis/store.ts'
import type { CoreDeps } from './contracts/index.ts'
import type { CommitmentItem, MedicationItem, MemoryItem, NewMemoryItem } from './contracts/memory.ts'
import { memoryFor } from './core/memory.ts'
import { jsonOut } from './core/tool-kit.ts'
import { currentPlan, doneCounts } from './interventions.ts'
import { asJson } from './json.ts'
import { activePerson, rootDir } from './people/store.ts'
import { readProfile } from './profile.ts'
import { readSelf, SELF_SPEC } from './selfmeasure.ts'

const FILE_CAP = 256 * 1024

function active(items: MemoryItem[]): MemoryItem[] {
  return items.filter((item) => item.status === 'active' && item.kind !== 'asked_topic')
}

function cell(text: string): string {
  return text.replace(/\|/g, '｜').replace(/\s+/g, ' ').trim()
}

export interface MemberFileInput { dataDir: string; label_zh: string; personId: string; today: string }

/** The member file, in the coach template's sections and order, from what LongPi keeps. */
export function renderMemberFile(input: MemberFileInput): string {
  const items = active(memoryFor(input.dataDir).read().items)
  const of = <K extends MemoryItem['kind']>(kind: K) => items.filter((item) => item.kind === kind) as Array<Extract<MemoryItem, { kind: K }>>
  const profile = readProfile(input.dataDir)
  const style = of('style').at(-1)
  const counts = (() => {
    try {
      return doneCounts(input.dataDir)
    } catch {
      return new Map<string, number>()
    }
  })()
  const total = (item: CommitmentItem) => (item.carried_count ?? 0) + (item.plan_item ? counts.get(item.plan_item) ?? 0 : 0)
  const planTitles = new Map((currentPlan(input.dataDir)?.items ?? []).map((item) => [item.id, item.title]))
  const meds = (items.filter((item) => item.kind === 'medication' || item.kind === 'supplement') as MedicationItem[]).filter((item) => !item.stopped)
  const sex = profile.sex === 'male' ? '男' : profile.sex === 'female' ? '女' : ''
  const lines: string[] = [
    `# ${input.label_zh}`,
    '',
    `<!-- 由 LongPi 在 ${input.today} 导出。LongPi 里的数据是原始记录，这份文件供查看和保存；要修改，在对话里告诉 Pi 或在健康页里改。 -->`,
    '',
    '## 基本',
    '',
    `- 年龄 / 出生年月：${profile.age ?? ''}${profile.birthYear ? `（${profile.birthYear} 年出生）` : ''}`,
    `- 性别：${sex}`,
    `- 称呼方式：${style?.address ?? '你'}　　风格：${style?.tone ?? 'upbeat'}${style ? `（${style.text_zh}）` : ''}`,
    `- 在用的药和补剂：${meds.map((item) => `${item.name_zh}${item.regimen_text ? `（${item.regimen_text}）` : ''}`).join('、')}`,
    '',
    '## 为什么 & 想要的画面',
    '',
    `- 为什么在乎：${of('motivation').map((item) => item.text_zh).join('；')}`,
    `- 七八十岁时想还能做的事：${of('vision').map((item) => item.text_zh).join('；')}`,
    '',
    '## 生活和偏好',
    '',
    ...[...of('goal').map((item) => `目标：${item.text_zh}`), ...of('exclusion').map((item) => `不要：${item.text_zh.replace(/^不要/, '')}`),
      ...of('condition').map((item) => `身体状况：${item.text_zh}`), ...of('family_history').map((item) => `家族史：${item.text_zh}`),
      ...of('preference').map((item) => item.text_zh), ...of('note').map((item) => item.text_zh)].map((line) => `- ${line}`),
    '',
    '## 近期大事',
    '',
    ...of('life_event').slice(-8).map((item) => `- ${item.from}${item.to ? ` 至 ${item.to}` : ''}：${item.text_zh}`),
    '',
    '## 小承诺',
    '',
    '| 承诺 | 当…时 | 频率 | 开始 | 累计次数 | 状态 |',
    '|---|---|---|---|---|---|',
    ...of('commitment').map((item) => {
      const m = /^当(.+?)[时後后]?[，,]\s*我就(.+)$/.exec(item.text_zh)
      const what = m ? m[2] ?? item.text_zh : item.text_zh
      const when = m ? m[1] ?? '' : ''
      const planned = item.plan_item && planTitles.has(item.plan_item) ? `（方案：${planTitles.get(item.plan_item)}）` : ''
      return `| ${cell(what)}${cell(planned)} | ${cell(when)} |  | ${item.started} | ${total(item)} | ${item.graduated ? `已成习惯（${item.graduated}）` : '在做'} |`
    }),
    '',
    '## 测量',
    '',
    '| 日期 | 指标 | 数值 | 单位 | 来源 |',
    '|---|---|---|---|---|',
    ...readSelf(input.dataDir).slice(-30).map((row) => `| ${row.date} | ${SELF_SPEC[row.key].label_zh} | ${row.value} | ${row.unit} | 自己量 |`),
    '',
    '体检和化验结果在健康页「指标」里。',
    '',
    '## 检测和报告',
    '',
  ]
  const cur = currentImport(input.dataDir)
  if (cur) {
    const toDoctor = doctorItems(cur.value)
    lines.push(`- ${cur.meta.imported_at.slice(0, 10)} 深度分析：报告在健康页「深度分析」里；方案 ${cur.value.plan.items.length - toDoctor.length} 项，交给医生 ${toDoctor.length} 项。`)
    for (const r of cur.value.retests.slice(0, 8)) lines.push(`  - 复测：${r.what}（${r.after_weeks} 周后${r.due ? `，${r.due}` : ''}）`)
  }
  lines.push('', '## 小胜利', '', ...of('win').slice(-20).map((item) => `- ${item.day}：${item.text_zh}`), '',
    '## 后台', '', '- 运行在：LongPi', `- 分析师会员编号：${memberIdFor(input.personId)}`, '')
  return lines.join('\n')
}

// ---------------------------------------------------------------- reading a file from the standalone coach

const DAY = /(\d{4}-\d{2}-\d{2})/

function sections(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  let current = ''
  for (const raw of text.split(/\r?\n/)) {
    const head = /^##\s+(.+?)\s*$/.exec(raw)
    if (head) { current = head[1] ?? ''; out.set(current, []); continue }
    if (current && raw.trim() && !/^<!--/.test(raw.trim())) out.get(current)?.push(raw.trim())
  }
  return out
}

function field(lines: string[], label: RegExp): string {
  for (const line of lines) {
    const m = new RegExp(`^-\\s*(?:${label.source})[：:]\\s*(.*)$`).exec(line)
    if (m && (m[1] ?? '').trim()) return (m[1] ?? '').trim()
  }
  return ''
}

function tableRows(lines: string[]): string[][] {
  return lines.filter((line) => line.startsWith('|') && !/^\|\s*-/.test(line))
    .map((line) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())).slice(1)
}

export interface ParsedMemberFile { items: NewMemoryItem[]; skipped_zh: string[] }

/** The standalone coach's member file as memory items (the person's own file: confirmed, provenance import). */
export function parseMemberFile(text: string, at: string, today: string): ParsedMemberFile {
  const s = sections(text)
  const base = { confirmed: true, provenance: { kind: 'import' as const, at, by: 'M0' as const } }
  const items: NewMemoryItem[] = []
  const skipped: string[] = []
  const add = (item: Record<string, unknown>) => { if (String(item.text_zh ?? '').trim()) items.push({ ...base, ...item } as NewMemoryItem) }

  const why = s.get('为什么 & 想要的画面') ?? []
  add({ kind: 'motivation', text_zh: field(why, /为什么在乎/) })
  add({ kind: 'vision', text_zh: field(why, /七八十岁时想还能做的事|想要的画面/) })

  const basic = s.get('基本') ?? []
  const styleLine = basic.find((line) => /称呼方式/.test(line)) ?? ''
  const tone = /风格[：:]\s*(upbeat|gentle|direct)/.exec(styleLine)?.[1]
  const address = /称呼方式[：:]\s*(您|你)/.exec(styleLine)?.[1]
  if (tone || address) add({ kind: 'style', text_zh: `称${address ?? '你'}，风格 ${tone ?? 'upbeat'}`, ...(tone ? { tone } : {}), ...(address ? { address } : {}) })
  if (field(basic, /在用的药和补剂/)) skipped.push('在用的药和补剂没有导入：请在对话里再告诉 Pi 一次，确认后记下。')

  for (const line of s.get('生活和偏好') ?? []) {
    const m = /^-\s*(.+?)[：:]\s*(.+)$/.exec(line)
    if (m && (m[2] ?? '').trim()) add({ kind: 'note', text_zh: `${m[1]}：${m[2]}` })
  }
  for (const line of s.get('近期大事') ?? []) {
    const text = line.replace(/^-\s*/, '').replace(/^（.*）$/, '').trim()
    const from = DAY.exec(text)?.[1]
    if (text) add({ kind: 'life_event', event: 'other', text_zh: text.replace(DAY, '').replace(/^[\s：:+]+/, '') || text, from: from ?? today, to: null, freezes_streak: false })
  }
  for (const row of tableRows(s.get('小承诺') ?? [])) {
    const [what = '', when = '', , started = '', count = '', state = ''] = row
    if (!what) continue
    const n = Number.parseInt(count, 10)
    add({ kind: 'commitment', text_zh: when ? `当${when.replace(/^当|时$/g, '')}时，我就${what}` : what, confidence: null,
      started: DAY.exec(started)?.[1] ?? today, ...(Number.isFinite(n) && n > 0 ? { carried_count: n } : {}),
      ...(/毕业|习惯/.test(state) ? { graduated: today } : {}) })
  }
  for (const line of s.get('小胜利') ?? []) {
    const text = line.replace(/^-\s*/, '').trim()
    if (!text) continue
    const day = DAY.exec(text)?.[1]
    add({ kind: 'win', text_zh: text.replace(DAY, '').replace(/^[\s：:]+/, '') || text, day: day ?? today })
  }
  const measured = tableRows(s.get('测量') ?? []).filter((row) => row.some(Boolean)).length
  if (measured > 0) skipped.push(`测量表里的 ${measured} 行没有导入：体检和化验请在健康页上传报告；家里量的腰围、血压、体重可以告诉 Pi 再记。`)
  return { items, skipped_zh: skipped }
}

function readFileAt(raw: string): { text: string } | { error: string } {
  const expanded = raw === '~' ? homedir() : raw.startsWith('~/') ? join(homedir(), raw.slice(2)) : raw
  if (!isAbsolute(expanded)) return { error: 'path must be absolute (or start with ~/)' }
  const path = resolve(expanded)
  if (extname(path).toLowerCase() !== '.md') return { error: 'only a .md member file is read' }
  try {
    const st = lstatSync(path)
    if (!st.isFile()) return { error: 'not a regular file' }
    if (st.size > FILE_CAP) return { error: 'the file is too large for a member file' }
    return { text: readFileSync(path, 'utf8') }
  } catch {
    return { error: 'file not found' }
  }
}

export function registerMemberFile(ctx: Context, deps: CoreDeps): void {
  const input = (): MemberFileInput => {
    const who = activePerson(rootDir(deps.config().dataDir))
    return { dataDir: deps.dataDir(), label_zh: who.person ? who.label_zh : '我', personId: who.id, today: new Date().toISOString().slice(0, 10) }
  }

  deps.http.route('GET', '/api/longpi/member-file', async () => {
    const value = input()
    return { __raw: { type: 'text/markdown; charset=utf-8', body: renderMemberFile(value), headers: { 'Content-Disposition': `attachment; filename="longpi-member-${value.today}.md"` } } }
  })

  ctx.tools.register(defineTool({
    name: 'import_member_file',
    description: 'Read a member file the person brings from the standalone longevity coach (~/.longevity-coach/<name>.md) into LongPi once: why they care, their vision, style, life and preferences, life events, small commitments (their earlier counts are kept) and wins. Medicines and the measurement table are not imported; say so. Use only when they name or attach such a file.',
    parameters: { path: { type: 'string', required: true, description: 'Absolute path of the .md file (~/ allowed).' } },
    output: jsonOut,
    timeoutMs: 20_000,
    isConcurrencySafe: () => false,
    async execute(args: { path?: string }) {
      const read = readFileAt(String(args.path ?? '').trim())
      if ('error' in read) return asJson({ ok: false, error: read.error })
      const now = new Date().toISOString()
      const parsed = parseMemberFile(read.text, now, now.slice(0, 10))
      const memory = memoryFor(deps.dataDir())
      const result = memory.apply(parsed.items.map((item) => ({ op: 'add' as const, item })), 'M0')
      deps.invalidate()
      const kinds: Record<string, string> = { motivation: '为什么在乎', vision: '想要的画面', style: '称呼和风格', note: '生活和偏好', life_event: '近期大事', commitment: '小承诺', win: '小胜利' }
      const tally = new Map<string, number>()
      for (const item of parsed.items) tally.set(kinds[item.kind] ?? item.kind, (tally.get(kinds[item.kind] ?? item.kind) ?? 0) + 1)
      return asJson({
        ok: result.applied.length > 0,
        imported_zh: [...tally.entries()].map(([k, n]) => `${k} ${n} 条`).join('、'),
        skipped_zh: parsed.skipped_zh,
        how_to_use: 'Tell them in one or two sentences what came in and what did not (skipped_zh), and that their earlier counts carry on. A commitment that matches a plan item can be linked later with remember_for_me (replaces + plan_item).',
      })
    },
  }))
}
