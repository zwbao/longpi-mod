// Load the signed study manifests shipped in data/studies, plus their consent text.

import { existsSync, readFileSync, readdirSync } from '../../sys/fs.ts'
import { dirname, join } from '../../sys/path.ts'
import { fileURLToPath, libFile } from '../../sys/url.ts'
import type { StudyManifest } from '../contracts/science.ts'
import { sha256Hex, verifyManifest, type VerifyResult } from './verify.ts'

export interface LoadedStudy {
  manifest: StudyManifest
  text_zh: string
  sha256: string
  verify: VerifyResult
  consent_hash_ok: boolean
}

export function studiesDir(): string {
  const here = dirname(libFile())
  const candidates = [join(here, '../../data/studies'), join(here, '../data/studies')]
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0] ?? 'data/studies'
}

export function consentText(studyId: string): string {
  const path = join(studiesDir(), `${studyId}.consent.zh.txt`)
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : ''
}

export function loadStudies(): LoadedStudy[] {
  const dir = studiesDir()
  if (!existsSync(dir)) return []
  const names = readdirSync(dir).filter((name) => name.endsWith('.manifest.json')).sort()
  return names.map((name) => {
    const file = readFileSync(join(dir, name))
    const raw = JSON.parse(file.toString('utf8')) as StudyManifest
    const text = consentText(raw.id)
    return {
      manifest: raw,
      text_zh: text,
      sha256: sha256Hex(file),
      verify: verifyManifest(raw),
      consent_hash_ok: sha256Hex(text) === raw.consent?.text_zh_sha256,
    }
  })
}

export function loadStudy(id: string): LoadedStudy | null {
  return loadStudies().find((row) => row.manifest.id === id) ?? null
}

/** Questions the page shows. The correct index stays on disk. */
export function publicQuestions(manifest: StudyManifest): Array<{ id: string; question_zh: string; options_zh: string[] }> {
  return manifest.consent.comprehension.map(({ id, question_zh, options_zh }) => ({ id, question_zh, options_zh }))
}

export function ethicsLine(manifest: StudyManifest): string {
  if (manifest.ethics.approval_id && manifest.ethics.registry.id) {
    return `已有批件 ${manifest.ethics.approval_id}。`
  }
  return '研究正式开始后才会发出，现在只保存在你的设备上。'
}
