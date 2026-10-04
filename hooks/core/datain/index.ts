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

/** Imaging grades become a doctor step. Advice alone does not replace the stage's next step. */
export const datainCandidates: CandidateProvider = (_pack) => {
  const rows = narrativeFindings()
  const lead = leadImaging(rows)
  if (!lead) return []
  const grade = Number(lead.grade ?? 0)
  const tirads = lead.kind === 'ti-rads'
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
