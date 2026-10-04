// report_reader (M7): phrases a report that was just ingested. The facts are already extracted.
// The model, when it is wired, may only order those sentences. Until then the fallback is the read-back.

import type { AgentProfile } from '../contracts/agents.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { IngestResult } from '../datain/upload.ts'
import { parseReport, type ParseOpts, type ParsedStores } from '../stores/parse.ts'

export interface ReportDigest {
  new_markers: Array<{ label_zh: string; text: string }>
  findings: IngestResult['findings']
  suspicion: 'none' | 'wrong_person' | 'duplicate'
  read_back_zh: string
  forwarded: boolean
}

const PROMPT = `你是 LongPi 的报告阅读员。输入是已经提取好的 JSON：findings（报告原文里的叙述，含 TI-RADS / BI-RADS）、indicators（解析到的项数）、suspicion（none / wrong_person / duplicate）、forwarded。

你只组织这几句话，不增加事实。
1. 用 findings 里的原句告诉对方报告写了什么。TI-RADS、BI-RADS 的分级照实说，并说带给医生看；不判断要不要穿刺，不说患有、确诊或治愈。
2. suspicion 是 wrong_person：只说这份不是本人的报告、没有写入。不要写出任何一个姓名。
3. suspicion 是 duplicate：说已经保存过，没有重复写入。
4. 数字只用输入里出现过的。不写剂量，不建议开始、停止或更换药物。
5. 不出现工具名、技能 id，也不要称呼对方的名字，用「你」。
6. 若输入里有 store_counts，只说记下了多少行、有多少行没通过检查。不要列出探针、丰度或蛋白的原始表，也不要据此声称更年轻。
调用 emit 一次返回 read_back_zh、suspicion、forwarded。
`

function digestOf(extra: unknown): ReportDigest {
  const row = (extra && typeof extra === 'object' ? extra : {}) as Partial<IngestResult>
  const findings = Array.isArray(row.findings) ? row.findings : []
  const suspicion = row.wrong_person ? 'wrong_person' : row.duplicate ? 'duplicate' : 'none'
  const read = typeof row.read_back_zh === 'string' && row.read_back_zh.trim()
    ? row.read_back_zh.trim()
    : findings.map((item) => item.text_zh).join(' ') || '这份报告没有解析出新的叙述。'
  return {
    new_markers: row.indicators != null ? [{ label_zh: '解析到的指标', text: String(row.indicators) }] : [],
    findings,
    suspicion,
    read_back_zh: read,
    forwarded: row.forwarded === true,
  }
}

export const reportReaderProfile: AgentProfile<IngestResult | undefined, ReportDigest> = {
  id: 'report_reader',
  owner: 'M7',
  modes: ['one_shot', 'in_turn'],
  prompt: ['report_reader.md'],
  tools: ['read_personal_situation', 'read_narrative_findings', 'forward_report'],
  output_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['read_back_zh', 'suspicion', 'forwarded'],
    properties: {
      read_back_zh: { type: 'string' },
      suspicion: { type: 'string', enum: ['none', 'wrong_person', 'duplicate'] },
      forwarded: { type: 'boolean' },
      findings: { type: 'array' },
    },
  },
  route: { reasoningEffort: 'low', maxTokens: 2000 },
  deadline_ms: 20000,
  input(pack, extra) {
    const digest = digestOf(extra)
    return {
      today: pack?.today ?? '',
      stage: pack?.stage ?? '',
      suspicion: digest.suspicion,
      forwarded: digest.forwarded,
      indicators: digest.new_markers,
      findings: digest.findings.map((row) => ({ kind: row.kind, text_zh: row.text_zh, date: row.date, grade: row.grade ?? '' })),
      store_counts: Array.isArray((extra as IngestResult | undefined)?.stores)
        ? (extra as IngestResult).stores?.map((row) => ({ kind: row.kind, stored: row.stored, rejected: row.rejected, coverage_zh: row.coverage_zh }))
        : [],
    }
  },
  validate(out) {
    if (!out || typeof out !== 'object') return { ok: false, errors: ['not an object'] }
    const row = out as Partial<ReportDigest>
    if (typeof row.read_back_zh !== 'string' || !row.read_back_zh.trim()) return { ok: false, errors: ['read_back_zh required'] }
    if (/确诊|患有|治愈/.test(row.read_back_zh)) return { ok: false, errors: ['no diagnosis claim'] }
    return { ok: true, value: digestOf({ ...row, findings: row.findings, forwarded: row.forwarded, wrong_person: row.suspicion === 'wrong_person', duplicate: row.suspicion === 'duplicate', read_back_zh: row.read_back_zh }) }
  },
  fallback(_pack: FactPack, extra) {
    return digestOf(extra)
  },
}

export function reportReaderPrompt(): string {
  return PROMPT
}

/** Propose typed rows from a consumer report or a matrix. Does not write the store. */
export function proposeStoreRows(text: string, opts: ParseOpts): ParsedStores {
  return parseReport(text, opts)
}
