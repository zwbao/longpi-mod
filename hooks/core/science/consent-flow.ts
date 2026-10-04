// Per-study consent. A grant requires an explicit confirm and a passed comprehension check.
// Withdrawal deletes shares that have not been released.

import { existsSync, readdirSync, unlinkSync } from '../../sys/fs.ts'
import { join } from '../../sys/path.ts'
import type { Id, IsoTime } from '../contracts/common.ts'
import type { ConditionFlag, DrugClass } from '../contracts/memory.ts'
import type { ConsentRecord, StudyManifest } from '../contracts/science.ts'
import { appendJsonl, newId, readJson, readJsonl, writeJsonAtomic } from '../core/store.ts'
import { closeStudyBudget, RELEASE_STAYS_ZH } from './budget.ts'
import { appendLog } from './translog.ts'

export interface Answer { id: string; choice: number }

export function consentsPath(dataDir: string): string {
  return join(dataDir, 'science', 'consents.jsonl')
}

export function readConsents(dataDir: string): ConsentRecord[] {
  return readJsonl<ConsentRecord>(consentsPath(dataDir), (raw) => {
    const row = raw as ConsentRecord
    return row && typeof row.id === 'string' && typeof row.decision === 'string' ? row : null
  })
}

export function latestConsent(dataDir: string, studyId: string): ConsentRecord | null {
  const rows = readConsents(dataDir).filter((row) => row.study_id === studyId && row.scope === 'study')
  return rows.length > 0 ? rows[rows.length - 1] ?? null : null
}

export function activeStudyIds(dataDir: string): string[] {
  const latest = new Map<string, ConsentRecord>()
  for (const row of readConsents(dataDir)) {
    if (row.scope === 'study' && row.study_id) latest.set(row.study_id, row)
  }
  return [...latest.values()].filter((row) => row.decision === 'granted').map((row) => row.study_id ?? '')
}

export function gradeAnswers(manifest: StudyManifest, answers: readonly Answer[]): { asked: number; correct: number; passed: boolean } {
  const questions = manifest.consent.comprehension
  let correct = 0
  for (const question of questions) {
    const given = answers.find((row) => row.id === question.id)
    if (given && given.choice === question.correct) correct += 1
  }
  return { asked: questions.length, correct, passed: questions.length > 0 && correct === questions.length }
}

function attemptsPath(dataDir: string): string {
  return join(dataDir, 'science', 'attempts.json')
}

function bumpAttempts(dataDir: string, studyId: string): number {
  const prior = readJson<Record<string, number>>(attemptsPath(dataDir), (raw) => (raw && typeof raw === 'object' ? raw as Record<string, number> : {}), () => ({}))
  const next = (prior[studyId] ?? 0) + 1
  writeJsonAtomic(attemptsPath(dataDir), { ...prior, [studyId]: next })
  return next
}

export interface PersonFacts {
  age: number | null
  sex: 'female' | 'male' | 'other' | 'unknown'
  conditions: ConditionFlag[]
  drug_classes: DrugClass[]
}

export function eligibility(manifest: StudyManifest, person: PersonFacts): { ok: true } | { ok: false; reason_zh: string } {
  if (person.age == null) return { ok: false, reason_zh: '档案中尚无出生年份，无法确认是否已成年' }
  if (person.age < 18 || person.conditions.includes('minor')) return { ok: false, reason_zh: '这项研究不纳入未成年人' }
  const [low, high] = manifest.eligibility.age
  if (person.age < low || person.age > high) return { ok: false, reason_zh: `年龄不在 ${low}–${high} 岁` }
  if (manifest.eligibility.sex && person.sex !== 'unknown' && !manifest.eligibility.sex.includes(person.sex as 'female' | 'male')) {
    return { ok: false, reason_zh: '这项研究的性别范围不包括你' }
  }
  for (const flag of manifest.eligibility.exclude_conditions ?? []) {
    if (person.conditions.includes(flag)) return { ok: false, reason_zh: '根据排除条件，本次暂不参加' }
  }
  for (const flag of manifest.eligibility.require ?? []) {
    if (!person.conditions.includes(flag)) return { ok: false, reason_zh: '尚无该研究要求的健康状况记录' }
  }
  for (const drug of manifest.eligibility.exclude_drug_classes ?? []) {
    if (person.drug_classes.includes(drug)) return { ok: false, reason_zh: '正在用的药在这项研究的排除名单里' }
  }
  return { ok: true }
}

export interface GrantInput {
  dataDir: string
  manifest: StudyManifest
  manifest_sha256: string
  answers: readonly Answer[]
  confirm: boolean
  explained_by: 'agent' | 'page'
  session_id?: string
  mode: 'simulated' | 'local'
  at?: IsoTime
}

export function grantConsent(input: GrantInput): { ok: true; consent: ConsentRecord } | { ok: false; reason_zh: string; comprehension: { asked: number; correct: number; passed: boolean; attempts: number } } {
  const grade = gradeAnswers(input.manifest, input.answers)
  const attempts = bumpAttempts(input.dataDir, input.manifest.id)
  const comprehension = { ...grade, attempts }
  if (!input.confirm) {
    return { ok: false, reason_zh: '需明确确认后才记录为同意', comprehension }
  }
  if (!grade.passed) {
    appendLog(input.dataDir, 'consent', `理解测验未通过（${grade.correct}/${grade.asked}），未记录为同意`, input.manifest.id, input.at)
    return { ok: false, reason_zh: '有答案与说明不一致。请重新阅读说明，暂不能记录为同意。', comprehension }
  }
  const at = input.at ?? new Date().toISOString()
  const logged = appendLog(input.dataDir, 'consent', `同意参加「${input.manifest.title_zh}」。理解测验 ${grade.correct}/${grade.asked}。`, input.manifest.id, at)
  const consent: ConsentRecord = {
    id: newId('cnsent'),
    scope: 'study',
    study_id: input.manifest.id,
    manifest_version: input.manifest.version,
    manifest_sha256: input.manifest_sha256,
    decision: 'granted',
    at,
    mode: input.mode,
    text_version: input.manifest.consent.text_version,
    explained_by: input.explained_by,
    ...(input.session_id ? { session_id: input.session_id } : {}),
    comprehension,
    translog_seq: logged.seq,
  }
  appendJsonl(consentsPath(input.dataDir), consent)
  return { ok: true, consent }
}

export function withdrawConsent(dataDir: string, manifest: StudyManifest, at: IsoTime = new Date().toISOString()): { ok: true; consent: ConsentRecord; deleted: number; released_stays: true; statement_zh: string } | { ok: false; reason_zh: string } {
  const current = latestConsent(dataDir, manifest.id)
  if (!current || current.decision !== 'granted') return { ok: false, reason_zh: '当前没有有效的同意' }
  const deleted = deleteUnreleased(dataDir, manifest.id)
  closeStudyBudget(dataDir, manifest.id)
  const logged = appendLog(dataDir, 'withdraw', `退出「${manifest.title_zh}」。已删除 ${deleted} 份尚未发布的合计。${RELEASE_STAYS_ZH}`, manifest.id, at)
  const consent: ConsentRecord = {
    id: newId('cnsent'),
    scope: 'study',
    study_id: manifest.id,
    manifest_version: manifest.version,
    manifest_sha256: current.manifest_sha256,
    decision: 'withdrawn',
    at,
    mode: 'simulated',
    text_version: manifest.consent.text_version,
    explained_by: current.explained_by,
    withdrawal: { at, deleted_unreleased: true },
    translog_seq: logged.seq,
  }
  appendJsonl(consentsPath(dataDir), consent)
  return { ok: true, consent, deleted, released_stays: true, statement_zh: RELEASE_STAYS_ZH }
}

function deleteUnreleased(dataDir: string, studyId: string): number {
  const dir = join(dataDir, 'science', 'outbox')
  if (!existsSync(dir)) return 0
  let deleted = 0
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const path = join(dir, name)
    const row = readJson<{ study_id?: string; released?: boolean }>(path, (raw) => raw as { study_id?: string; released?: boolean }, () => ({}))
    if (row.study_id === studyId && row.released !== true) {
      unlinkSync(path)
      deleted += 1
    }
  }
  return deleted
}

export function consentIdOk(id: string): id is Id {
  return /^[a-z0-9][a-z0-9-]{5,63}$/.test(id)
}
