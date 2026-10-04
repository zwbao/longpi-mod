// research_coordinator (M8). One-shot give-back and consent wording. The fallback is the manifest text.
// The person's name is not part of the model input (D10).

import { readFileSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { AgentProfile } from '../contracts/agents.ts'
import type { FactPack } from '../contracts/factpack.ts'
import { wordingProblem } from '../science/nof1.ts'

export const RESEARCH_PROMPT = `你是 LongPi 的研究协调员。你只解释已经写在研究说明里的内容，不新增承诺。
输入的 JSON 里没有此人的姓名。称呼用「你」。不要写出姓名。
规则：
1. 参加研究必须先通过理解测验，并且此人明确同意。测验没通过就不能说已经参加。
2. 不说「证明」「治愈」「患有」「确诊」「年轻了」。走路和血糖只说「差别」或「有关」。
3. 不建议开始、停止或调整任何药。
4. 这个版本不能打开 live。如果对方要把数据交到外面的服务器，说明还没有伦理批件和 ChiCTR，只能在本机模拟。
5. 基因数据不参加任何研究。
6. 数字只用输入里给出的 text。没有的数字不要编。
7. 原始化验、姓名、图片和自由文本不会离开这台电脑。离开的只有加了噪声、并被安全聚合遮住的合计。
调用 emit 一次，不要输出别的文字。`

export function promptMatchesFile(): boolean {
  try {
    const path = join(dirname(libFile()), 'prompts', 'research_coordinator.md')
    return readFileSync(path, 'utf8').trim() === RESEARCH_PROMPT.trim()
  } catch {
    return true
  }
}

export interface ResearchExtra {
  kind: 'consent' | 'protocol' | 'give_back'
  study_id: string
  text_zh: string
  numbers: Array<{ key: string; text: string }>
  passed: boolean
}

export interface ResearchOut {
  kind: 'consent' | 'protocol' | 'give_back'
  text_zh: string
  study_id: string
  passed_check: boolean
}

const SCHEMA = {
  type: 'object' as const,
  properties: {
    kind: { type: 'string', enum: ['consent', 'protocol', 'give_back'] },
    text_zh: { type: 'string' },
    study_id: { type: 'string' },
    passed_check: { type: 'boolean' },
  },
  required: ['kind', 'text_zh', 'study_id', 'passed_check'],
  additionalProperties: false,
}

export function researchInput(pack: FactPack, extra: ResearchExtra): unknown {
  return {
    today: pack.today,
    age: pack.person.age,
    sex: pack.person.sex,
    kind: extra.kind,
    study_id: extra.study_id,
    text_zh: extra.text_zh.slice(0, 1200),
    numbers: extra.numbers.slice(0, 12),
    passed: extra.passed,
    science_mode: pack.science.mode,
  }
}

export const researchCoordinator: AgentProfile<ResearchExtra, ResearchOut> = {
  id: 'research_coordinator',
  owner: 'M8',
  modes: ['one_shot', 'in_turn'],
  prompt: [RESEARCH_PROMPT],
  tools: ['list_studies', 'explain_study', 'design_n_of_1', 'record_study_consent'],
  output_schema: SCHEMA,
  route: { reasoningEffort: 'high', maxTokens: 2000 },
  deadline_ms: 60000,
  input: researchInput,
  validate(out, pack): { ok: true; value: ResearchOut } | { ok: false; errors: string[] } {
    const row = out && typeof out === 'object' ? out as Record<string, unknown> : {}
    const text = typeof row.text_zh === 'string' ? row.text_zh.trim() : ''
    const errors: string[] = []
    if (!text) errors.push('empty')
    const banned = wordingProblem(text)
    if (banned) errors.push(banned)
    if (pack.person.display_name && text.includes(pack.person.display_name)) errors.push('name')
    if (row.passed_check === true) errors.push('model cannot mark the check passed')
    if (errors.length > 0) return { ok: false, errors }
    const kind = row.kind === 'protocol' || row.kind === 'give_back' ? row.kind : 'consent'
    return { ok: true, value: { kind, text_zh: text.slice(0, 800), study_id: String(row.study_id ?? ''), passed_check: false } }
  },
  fallback(pack, extra): ResearchOut {
    const text = extra.text_zh.trim() || '请先看研究说明。理解测验通过之前，不会记为同意。'
    return { kind: extra.kind, text_zh: text.slice(0, 800), study_id: extra.study_id, passed_check: false }
  },
}
