// M1 seams (AA §3.6): the findings in the fact pack, and the doctor-first actions for the NBA ranker.

import type { FactPack } from '../contracts/factpack.ts'
import type { TriageFinding } from '../contracts/triage.ts'
import type { CandidateProvider, NextBestAction } from '../contracts/surfaces.ts'
import { addDays } from '../interventions.ts'

/** 「9 月 10 日」, with the year when it is not this year. */
function dayZhI(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
}

export function triageFindings(pack: Pick<FactPack, 'triage'>): TriageFinding[] {
  return pack.triage?.findings ?? []
}

export const DOCTOR_PROMPT_ZH = '这些偏低的指标意味着什么？看医生前要准备什么？'
export const BRIEF_PROMPT_ZH = '帮我准备一份给医生看的简报'
export const VISIT_PROMPT_ZH = '我看完医生了，医生说……'
/** After this many days with no answer, the step asks whether they went. */
const ASK_AFTER_DAYS = 14

function action(row: Omit<NextBestAction, 'provider' | 'reason_codes'> & { reason_codes?: string[] }): NextBestAction {
  return { provider: 'M1', reason_codes: [], ...row }
}

/**
 * Doctor first (M1): one mandatory action for every finding still open, which blocks drafting a plan; the
 * printable brief beside it; and, once a visit date has passed (or two weeks went by), "看完医生了吗？".
 */
export const triageCandidates: CandidateProvider = (pack) => {
  if (pack.stage === 'consent') return []
  const stop = pack.triage?.stop
  const open = (pack.triage?.findings ?? []).filter((row) => row.status !== 'visited' && row.priority !== 'should_surface')
  if (stop?.needs_sex && open.length === 0) {
    return [action({
      id: 'answer-sex', kind: 'answer_profile', priority: 100, mandatory: true, fact_ids: [],
      target: { surface: 'page', section: 'profile', prompt_zh: '帮我填写性别' },
      title_zh: stop.title_zh || '填写性别',
      detail_zh: stop.sentence_zh || '男女参考下限不同。请先填写性别，再判断是否需要就医。本次暂不转诊。',
      reason_codes: ['profile.sex_needed'],
    })]
  }
  if (!stop || open.length === 0) return []
  const factIds = open.map((row) => row.id)
  const care = (pack.triage?.care ?? []).filter((row) => factIds.includes(row.finding_id)).sort((a, b) => a.updated.localeCompare(b.updated)).at(-1)
  const out: NextBestAction[] = []
  const sexNote = stop.needs_sex ? '档案里还没有性别。男女参考下限不同，请先填写性别；介于两者之间的数值本次暂不转诊。' : ''
  const booked = care?.care_status === 'booked' && care.visit_date
  const asked = care?.care_status === 'advised' || care?.care_status === 'declined'
  const due = (booked && (care.visit_date as string) < pack.today) || (asked && addDays(care.updated.slice(0, 10), ASK_AFTER_DAYS) <= pack.today)
  if (due) {
    out.push(action({
      id: 'log-visit-outcome', kind: 'log_visit_outcome', priority: 100, mandatory: true, blocks: ['draft_plan'], fact_ids: factIds,
      target: { surface: 'page', section: 'care', prompt_zh: VISIT_PROMPT_ZH },
      title_zh: booked ? `${dayZhI(care.visit_date)}看医生了吗？医生怎么说？` : '是否已预约就诊？医生怎么说？',
      detail_zh: '请告诉 LongPi 医生的结论（或尚未就诊），下一步和方案将随之调整。',
      reason_codes: ['care.follow_up'],
    }))
  }
  out.push(action({
    // Once the visit date has passed, "how did it go" leads and the doctor step follows it.
    id: 'doctor-first', kind: 'see_doctor', priority: due ? 95 : 100, mandatory: true, blocks: ['draft_plan'], fact_ids: factIds,
    target: { surface: 'page', section: 'doctor', prompt_zh: DOCTOR_PROMPT_ZH },
    title_zh: booked && !due ? `已约 ${dayZhI(care.visit_date)}看医生：${stop.title_zh.replace(/^请先去看医生：/, '')}` : stop.title_zh,
    detail_zh: `${stop.sentence_zh}${sexNote}`,
    reason_codes: open.map((row) => row.rule),
  }))
  out.push(action({
    id: 'prepare-brief', kind: 'prepare_brief', priority: 80, mandatory: false, fact_ids: factIds,
    target: { surface: 'page', section: 'brief', prompt_zh: BRIEF_PROMPT_ZH },
    title_zh: '准备一页就诊简报',
    detail_zh: '多年趋势、要问医生的问题和建议复查的项目，可以打印或存成文件带去。',
    reason_codes: ['brief.offer'],
  }))
  if (stop.needs_sex) {
    out.push(action({
      id: 'answer-sex', kind: 'answer_profile', priority: 85, mandatory: false, fact_ids: factIds,
      target: { surface: 'page', section: 'profile', prompt_zh: '帮我填写性别' },
      title_zh: '填写性别', detail_zh: '血红蛋白和铁蛋白的参考下限男女不同；填写后判断更准。', reason_codes: ['profile.sex_needed'],
    }))
  }
  return out
}
