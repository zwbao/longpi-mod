import type { Catalog } from './catalog.ts'
import type { LatestOutput } from './history.ts'
import { domainSummary, matchSkills } from './match.ts'
import type { MountState } from './mirobody.ts'
import type { Receipt } from './runner.ts'
import { readFlags, type RecordSnapshot } from './records.ts'
import { PRODUCT_VERSION } from './version.ts'

export function buildBoard(input: {
  catalog: Catalog
  records: RecordSnapshot
  mount: MountState
  receipts: Receipt[]
  limit: number
  outputs?: Record<string, LatestOutput>
}) {
  const personal = input.catalog.cards.filter((card) => card.tier !== 'C')
  const domains = domainSummary(personal).map((row) => ({ domain: row.domain, count: row.count }))
  const outputs = input.outputs ?? {}
  const dispatch = matchSkills(input.catalog.cards, '', input.records.indicators, input.limit, {
    intents: input.catalog.intents,
    profile: { age: input.records.profile.age, sex: input.records.profile.sex },
    outputs,
    reads: readFlags(input.records),
  })
  return {
    product: 'dsh-plugin-longpi',
    version: PRODUCT_VERSION,
    profile: input.records.profile,
    estimated_age: input.records.estimated_age,
    skills: {
      home_set: Boolean(input.catalog.home),
      revision: input.catalog.revision,
      version: input.catalog.version,
      count: input.catalog.cards.length,
      personal: personal.length,
      error: input.catalog.error,
      domains,
      intents: input.catalog.intents.map((intent) => ({ id: intent.id, label: intent.label_zh })),
    },
    mirobody: {
      mounted: input.mount.mounted,
      peer: input.mount.peer,
      error: input.mount.error,
      engine: input.records.engine,
      mcp: input.records.mcp,
    },
    records: {
      status: input.records.record_status,
      error: input.records.record_error,
      read_errors: input.records.read_errors,
      missing_reads: input.records.missing_reads,
      // Self measurements merged into the list are not Mirobody indicators.
      indicator_count: input.records.indicators.filter((row) => row.source !== 'self').length,
      indicators: input.records.indicators.slice(0, 20),
      medications: input.records.medications.slice(0, 20),
    },
    dispatch: { matches: dispatch.matches, note: dispatch.note },
    near: dispatch.near,
    readouts: Object.entries(outputs).map(([key, item]) => ({ key, ...item })).slice(0, 12),
    // Which skill ran and how it ended; never report text (receipts from before 5.1 may still carry an excerpt).
    receipts: input.receipts.map((row) => ({ at: row.at, skill: row.skill, ok: row.ok, exit_code: row.exit_code, error_kind: row.error_kind ?? null })),
    boundary: '这不是诊断，也不能改处方。技能没写出的数字不要补。紧急情况请拨打 120。',
  }
}
