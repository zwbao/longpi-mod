import { process } from '../sys/process.ts'
// Run the methods the record can fill, through the same binder the chat uses.
// The plugin does not choose which method matters. It runs what binds, labels
// the result, and stops when the time budget is spent. Tier C is not executed.

import { createHash } from '../sys/crypto.ts'
import { existsSync, statSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import { bindRecord, type BindingProfile, type RecordView } from './bind.ts'
import { loadCatalog, type SkillCard } from './catalog.ts'
import type { MethodResult } from './contracts/library.ts'
import { setMethodResults } from './core/method-results.ts'
import { latestOutputs } from './history.ts'
import type { RecordIndicator } from './measurements.ts'
import { runSkill } from './runner.ts'

// Inputs are fingerprinted (values, profile, files): a change reruns at once; the time limit only bounds staleness.
const MEMO_MS = 30 * 60_000
const memo = new Map<string, { at: number; results: MethodResult[] }>()

export interface CollectInput {
  home: string
  dataDir: string
  pinnedVersion?: string
  profile: BindingProfile
  indicators: readonly RecordIndicator[]
  python: string
  timeoutMs: number
  runtimes?: Record<string, string>
  budgetMs?: number
}

function shouldRun(card: SkillCard): boolean {
  return Boolean(card.script) && card.tier !== 'C' && card.tier !== 'tool' && card.inputsStatus !== 'none'
}

function needsFreshOutput(card: SkillCard): boolean {
  return card.inputs.some((spec) => (spec.output_of ?? []).length > 0)
}

function personal(row: MethodResult): boolean {
  return row.label !== 'evidence-only' && row.outputs.some((item) => item.value != null && item.value !== '')
}

function viewOf(input: CollectInput): RecordView {
  const outputs: RecordView['outputs'] = {}
  for (const [key, item] of Object.entries(latestOutputs(input.dataDir))) {
    outputs[key] = { value: item.value, unit: item.unit, skill: item.skill }
  }
  return {
    home: input.home,
    indicators: input.indicators,
    profile: input.profile,
    outputs,
    pinnedVersion: input.pinnedVersion,
  }
}

function stamp(input: CollectInput): string {
  const files = ['methylation', 'taxa', 'proteins', 'conditions'].map((name) => {
    const path = join(input.dataDir, `${name}.json`)
    return existsSync(path) ? String(statSync(path).mtimeMs) : ''
  }).join(',')
  const rows = input.indicators.map((row) => `${row.name}=${row.value}@${row.date ?? ''}${row.loinc ?? ''}`).join('\n')
  const hash = createHash('sha1').update(rows).digest('hex')
  return [
    input.home, input.dataDir, input.pinnedVersion ?? '', input.profile.age ?? '', input.profile.sex,
    JSON.stringify(input.profile.risk ?? {}), input.profile.waist_cm ?? '', files, hash,
  ].join('\u0000')
}

async function pool(cards: readonly SkillCard[], limit: number, worker: (card: SkillCard) => Promise<void>): Promise<void> {
  if (cards.length === 0) return
  let index = 0
  const width = Math.max(1, Math.min(limit, cards.length))
  await Promise.all(Array.from({ length: width }, async () => {
    while (index < cards.length) {
      const card = cards[index]
      index += 1
      if (!card) return
      await worker(card)
    }
  }))
}

/** Exit-0 runs, including scripts that then have no personal number. */
/** Runs in progress by input stamp: a second build with the same inputs waits for the first instead of rerunning. */
const running = new Map<string, Promise<MethodResult[]>>()

export async function collectMethodResults(input: CollectInput): Promise<MethodResult[]> {
  const key = stamp(input)
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.results.map((row) => structuredClone(row))
  const pending = running.get(key)
  if (pending) return (await pending).map((row) => structuredClone(row))
  const run = collectNow(input, key)
  running.set(key, run)
  try {
    return await run
  } finally {
    running.delete(key)
  }
}

async function collectNow(input: CollectInput, key: string): Promise<MethodResult[]> {
  const catalog = loadCatalog(input.home)
  const runnable = catalog.cards.filter(shouldRun)
  const results: MethodResult[] = []
  const deadline = Date.now() + (input.budgetMs ?? 8_000)
  const timeoutMs = Math.max(1000, Math.min(input.timeoutMs || 8_000, 8_000))
  const runOne = async (card: SkillCard): Promise<void> => {
    if (Date.now() > deadline) return
    const report = bindRecord(card, viewOf(input))
    if (!report.ok || report.measurements.length + report.args.length === 0) return
    const ran = await runSkill({
      home: input.home,
      dataDir: input.dataDir,
      name: card.name,
      args: [],
      files: [],
      binding: {
        skill: card.name,
        inputs: Object.fromEntries(report.inputs_used.map((row) => [row.input, {
          source_row_id: row.source_row_id,
          value: row.value,
          unit: row.unit,
          provenance: row.provenance,
          quote: row.quote,
        }])),
      },
      bindingView: viewOf(input),
      python: input.python || 'python3',
      timeoutMs,
      revision: catalog.revision,
      profile: { age: input.profile.age, sex: input.profile.sex },
      useProfile: true,
      runtimes: input.runtimes,
    })
    if (ran.ok && ran.method) results.push(ran.method)
  }
  const first = runnable.filter((card) => !needsFreshOutput(card))
  const second = runnable.filter((card) => needsFreshOutput(card))
  await pool(first, 3, runOne)
  await pool(second, 3, runOne)
  memo.set(key, { at: Date.now(), results })
  return results.map((row) => structuredClone(row))
}

/** What the overview draws: personal numbers only. Evidence rows stay in the full run list. */
export function pageMethodResults(rows: readonly MethodResult[]): MethodResult[] {
  return rows.filter(personal)
}

export function publishMethodResults(rows: readonly MethodResult[]): MethodResult[] {
  const shown = pageMethodResults(rows)
  setMethodResults(shown)
  return shown
}

/** Unit tests keep the journey on the 0.5.6 path unless this is set. dsh collects. */
export function collectOnJourney(): boolean {
  if (process.env.LONGPI_COLLECT_METHODS === '0') return false
  if (process.env.LONGPI_COLLECT_METHODS === '1') return true
  return process.env.npm_lifecycle_event !== 'test'
}
