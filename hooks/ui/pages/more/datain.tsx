// 报告里的叙述, 用药, 病情, 基因 (client/datain/): what reports said in words, the medicines and conditions the person
// stated, and a genetics summary, all kept on this computer. Reports come in through the chat: Claude reads them.

import type { Ctx, Node } from '../../types.ts'
import { Buttons, C, fit } from '../../kit.tsx'
import { REPORT_PROMPT } from './connection.tsx'
import { Bullets, Err, Field, Note } from './ui.tsx'
import type { Finding, Genetics, Stores } from './types.ts'
import { day, errorOf, setSub, sub } from './util.ts'

const KIND_ZH: Record<string, string> = {
  'ti-rads': '甲状腺超声',
  'bi-rads': '乳腺超声',
  nodule: '结节',
  ultrasound: '超声',
  conclusion: '结论',
  advice: '医师建议',
  wrong_person: '不属于本档案',
  genetics: '基因报告',
}

const STORE_ZH: Record<string, string> = { methylation: '甲基化位点表', taxa: '菌群表', proteins: '蛋白表', conditions: '诊断编码' }

type FindingsJson = { findings?: Finding[]; genetics?: Genetics | null }

function loading(ctx: Ctx, path: string, what: string, key: string): Node[] | null {
  const cached = ctx.route(path)
  if (!cached || (cached.loading && cached.json === null)) return [Note(ctx.E, `正在读取${what}…`, `${key}-loading`)]
  if (cached.status !== 200) return [Err(ctx.E, `未能读取${what}：${cached.error || '请稍后再试'}`, `${key}-err`)]
  return null
}

export function findingsSummary(ctx: Ctx): string {
  const rows = ctx.json<FindingsJson>('findings')?.findings
  if (!rows) return ''
  return rows.length === 0 ? '暂无' : `${rows.length} 条`
}

export function FindingsSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Box, Text } = E
  const wait = loading(ctx, 'findings', '报告叙述', 'findings')
  const rows = ctx.json<FindingsJson>('findings')?.findings ?? []
  const stores = ctx.json<Stores>('stores')?.stores ?? {}
  const kept = Object.entries(stores).filter(([, row]) => row.on && (row.rows ?? 0) > 0).map(([kind, row]) => `${STORE_ZH[kind] ?? kind} ${row.rows} 行`)
  const list: Node[] = wait ?? (rows.length === 0
    ? [Note(E, '尚未从报告中读取超声、总检或医师建议。把报告的 PDF 或照片交给对话里的 Claude，它会读出超声分级、总检结论和医师建议。', 'findings-empty')]
    : rows.map((row) => (
      <Box key={`finding-${row.id}`} flexDirection="column" marginBottom={0}>
        <Text color={row.kind === 'wrong_person' ? C.warn : undefined} dimColor={row.kind !== 'wrong_person'}>
          {`${row.kind === 'wrong_person' ? `[${KIND_ZH[row.kind]}]` : KIND_ZH[row.kind] ?? '报告'} ${day(ctx, row.date)}`.trim()}
        </Text>
        <Text wrap="wrap">{row.page_note_zh || row.text_zh}</Text>
      </Box>
    )))
  return [
    ...list,
    kept.length > 0 ? Note(E, `另存的数据表：${kept.join('、')}`, 'findings-stores') : null,
    Buttons(E, [{ key: 'findings-report', label: '录入一份报告', onPress: () => ctx.act.fill(REPORT_PROMPT) }], 'findings-report-row'),
    Note(E, '照片或 PDF 都可以：拖进对话框，或粘贴文件路径。', 'findings-how'),
  ]
}

export function medsSummary(ctx: Ctx): string {
  const lines = ctx.json<{ lines?: string[] }>('meds')?.lines
  if (!lines) return ''
  return lines.length === 0 ? '尚未记录' : fit(lines.join('；'), 40)
}

export function MedsSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Text } = E
  const wait = loading(ctx, 'meds', '用药', 'meds')
  const lines = ctx.json<{ lines?: string[] }>('meds')?.lines ?? []
  const name = sub(ctx, 'meds.name')
  const dose = sub(ctx, 'meds.dose')
  const times = sub(ctx, 'meds.times')
  const save = async (patch: Partial<Record<'name' | 'dose' | 'times', string>> = {}) => {
    const med = patch.name ?? sub(ctx, 'meds.name')
    const howMuch = patch.dose ?? sub(ctx, 'meds.dose')
    const when = patch.times ?? sub(ctx, 'meds.times')
    setSub(ctx, 'meds.error', '')
    if (!med.trim()) {
      setSub(ctx, 'meds.error', '请先填写药名。')
      return
    }
    const out = await ctx.act.post('meds', { name: med.trim(), dose_text: howMuch.trim(), frequency_text: when.trim() }, { reload: ['meds'], done: '用药已保存。', quiet: true })
    if (!out.ok) {
      setSub(ctx, 'meds.error', errorOf(out.json, '保存失败'))
      return
    }
    setSub(ctx, 'meds.name', '')
    setSub(ctx, 'meds.dose', '')
    setSub(ctx, 'meds.times', '')
  }
  return [
    ...(wait ?? (lines.length > 0 ? lines.map((line, i) => <Text key={`med-${i}`} wrap="wrap">{`· ${line}`}</Text>) : [Note(E, '尚未记录用药。', 'meds-none')])),
    Field(ctx, { key: 'med-name', label: '药名', value: name, placeholder: '例如 阿托伐他汀', onInput: (v) => setSub(ctx, 'meds.name', v), onSubmit: (v) => { void save({ name: v }) } }),
    Field(ctx, { key: 'med-dose', label: '用法', value: dose, placeholder: '按处方填写，选填，例如 10 mg', onInput: (v) => setSub(ctx, 'meds.dose', v), onSubmit: (v) => { void save({ dose: v }) } }),
    Field(ctx, { key: 'med-times', label: '服用时间', value: times, placeholder: '选填，例如 每日早晨一次', onInput: (v) => setSub(ctx, 'meds.times', v), onSubmit: (v) => { void save({ times: v }) } }),
    Note(E, '用 Tab 换到下一格，填好后按回车或「保存用药」。', 'meds-how'),
    Err(E, sub(ctx, 'meds.error'), 'meds-err'),
    Buttons(E, [{ key: 'meds-save', label: '保存用药', primary: true, onPress: () => { void save() } }], 'meds-buttons'),
  ]
}

export function conditionsSummary(ctx: Ctx): string {
  const rows = ctx.json<{ conditions?: Array<{ id: string; text_zh: string }> }>('conditions')?.conditions
  if (!rows) return ''
  return rows.length === 0 ? '尚未记录' : fit(rows.map((row) => row.text_zh).join('；'), 40)
}

export function ConditionsSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Text } = E
  const wait = loading(ctx, 'conditions', '病情', 'cond')
  const rows = ctx.json<{ conditions?: Array<{ id: string; text_zh: string }> }>('conditions')?.conditions ?? []
  const save = async (text: string) => {
    setSub(ctx, 'cond.error', '')
    if (!text.trim()) return
    const out = await ctx.act.post('conditions', { name_zh: text.trim(), state: 'current' }, { reload: ['conditions'], done: '已保存。', quiet: true })
    if (!out.ok) setSub(ctx, 'cond.error', errorOf(out.json, '保存失败'))
  }
  return [
    ...(wait ?? (rows.length > 0 ? rows.map((row) => <Text key={`cond-${row.id}`} wrap="wrap">{`· ${row.text_zh}`}</Text>) : [Note(E, '尚未记录病情。', 'cond-none')])),
    Field(ctx, { key: 'cond-name', label: '病情或诊断', value: '', placeholder: '例如 脂肪肝，回车保存', onSubmit: (v) => { void save(v) } }),
    Err(E, sub(ctx, 'cond.error'), 'cond-err'),
    Note(E, '诊断只保存在这台电脑上。', 'cond-note'),
  ]
}

export function geneticsSummary(ctx: Ctx): string {
  const json = ctx.json<FindingsJson>('findings')
  if (!json) return ''
  return json.genetics ? '已保存基因报告' : '暂无基因摘要'
}

export function GeneticsSection(ctx: Ctx): Node[] {
  const E = ctx.E
  const { Box, Text } = E
  const wait = loading(ctx, 'findings', '基因摘要', 'gen')
  if (wait) return wait
  const row = ctx.json<FindingsJson>('findings')?.genetics ?? null
  if (!row) return [Note(E, '暂无基因摘要。叙述版基因报告（PDF）可以交给对话里的 Claude 读取。', 'gen-empty')]
  const variants = (row.variants ?? []).slice(0, 12)
  return [
    <Text key="gen-head" wrap="wrap">{(row.headlines_zh ?? []).join('；') || '已保存基因报告。'}</Text>,
    ...variants.map((item) => (
      <Box key={`gen-${item.rsid}`} flexDirection="row" justifyContent="space-between" width={ctx.width - 2}>
        <Text wrap="truncate-end">{item.note_zh || item.rsid}</Text>
        <Text dimColor>{item.note_zh ? `${item.rsid} ${item.genotype}` : item.genotype}</Text>
      </Box>
    )),
    Bullets(E, row.caveats_zh ?? [], 'gen-caveats', true),
    row.raw_export_zh ? Note(E, row.raw_export_zh, 'gen-raw') : null,
    row.sample_id ? Note(E, '样本号仅保存在这台电脑上，不会发给模型。', 'gen-sample') : null,
  ]
}
