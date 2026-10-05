// M7 seams (AA §3.6): narrative findings for the fact pack, and next steps when a report
// names a nodule the lab table does not store.

import type { CandidateProvider, NextBestAction } from '../contracts/surfaces.ts'
import { leadImaging, listFindings, type NarrativeFinding } from './narrative.ts'

export type { NarrativeFinding } from './narrative.ts'
export { listFindings, parseNarrative, storeFindings } from './narrative.ts'

let dataDirOf: () => string = () => ''

/** The plugin sets this at register time. Tests that call the seam directly set it too. */
export function bindDataDir(dataDir: () => string): void {
  dataDirOf = dataDir
}

export function narrativeFindings(): NarrativeFinding[] {
  return listFindings(dataDirOf())
}

function action(row: Omit<NextBestAction, 'provider'>): NextBestAction {
  return { provider: 'M7', ...row }
}

/** The largest dimension in a finding's text, in cm ("0.5×0.4cm", "8*4mm"); null when none is given. */
export function noduleSizeCm(text: string): number | null {
  const match = /(\d+(?:\.\d+)?)\s*(?:[×xX*＊]\s*(\d+(?:\.\d+)?)\s*)?(?:[×xX*＊]\s*(\d+(?:\.\d+)?)\s*)?(cm|mm|厘米|毫米)/i.exec(text)
  if (!match) return null
  const values = [match[1], match[2], match[3]].filter(Boolean).map(Number)
  const max = Math.max(...values)
  return /mm|毫米/i.test(match[4] ?? '') ? max / 10 : max
}

/**
 * Imaging grades and what they call for. TI-RADS: 1–2 benign, nothing to do; 3 routine follow-up as the report
 * says (C-TIRADS 2020: FNA not recommended for category 3; ACR TI-RADS: FNA for TR3 from 2.5 cm), a doctor step
 * only from 2.5 cm or when the size is not given; 4 and above a doctor step. BI-RADS: 1–2 nothing, 3 short-interval
 * follow-up, 4 and above a doctor step. Advice alone does not replace the stage's next step.
 */
export const datainCandidates: CandidateProvider = (_pack) => {
  const rows = narrativeFindings()
  const lead = leadImaging(rows)
  if (!lead) return []
  const grade = Number.parseInt(String(lead.grade ?? '0'), 10) || 0
  const tirads = lead.kind === 'ti-rads'
  // A size given on another line of the same grade (the same nodule, written twice) counts.
  const size = noduleSizeCm(lead.text_zh) ?? rows.filter((row) => row.kind === lead.kind && row.grade === lead.grade).map((row) => noduleSizeCm(row.text_zh)).find((value) => value != null) ?? null
  if (grade > 0 && grade <= 2) return []
  const followUp = grade === 3 && (tirads ? size != null && size < 2.5 : true)
  const where = tirads ? '甲状腺结节' : '乳腺超声'
  const scale = tirads ? 'TI-RADS' : 'BI-RADS'
  if (followUp) {
    return [action({
      id: 'narrative-imaging',
      kind: 'screening_topic',
      priority: 25,
      mandatory: false,
      reason_codes: [`narrative.${lead.kind}`],
      fact_ids: [lead.id],
      target: {
        surface: 'page',
        tab: 'profile',
        section: 'findings',
        prompt_zh: tirads ? '甲状腺结节 TI-RADS 3 要多久复查一次？' : '乳腺 BI-RADS 3 要怎么复查？',
      },
      title_zh: `${where} ${scale} 3：按报告建议复查`,
      detail_zh: `${lead.text_zh}${tirads ? '3 类通常按时复查超声即可，按报告写的间隔去复查。' : '3 类通常建议约 6 个月后复查。'}分级来自报告原文，不是诊断。`,
    })]
  }
  const title = tirads
    ? `甲状腺结节 TI-RADS ${lead.grade || grade}：请携带超声报告就诊`
    : `乳腺超声 BI-RADS ${lead.grade || grade}：请按报告建议到专科就诊`
  const priority = tirads ? 70 + Math.min(grade, 5) : 60 + Math.min(grade, 6)
  return [action({
    id: 'narrative-imaging',
    kind: 'see_doctor',
    priority,
    mandatory: false,
    reason_codes: [`narrative.${lead.kind}`],
    fact_ids: [lead.id],
    target: {
      surface: 'page',
      tab: 'profile',
      section: 'findings',
      prompt_zh: tirads ? '体检报告里的甲状腺结节 TI-RADS 是什么意思？要不要看医生？' : '报告里的 BI-RADS 要怎么随访？',
    },
    title_zh: title,
    detail_zh: `${lead.text_zh}分级来自报告原文，不是诊断。随访方式及是否穿刺由医生决定。`,
  })]
}
