// Science tools. They register only when scienceMode is simulated. Consent asks the person before it is stored.

import type { Context } from '../../sys/cordis.ts'
import { defineTool } from '../../sys/dsh-tools.ts'
import { join } from '../../sys/path.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { newId, readJson } from '../core/store.ts'
import { jsonOut, sessionOfExec } from '../core/tool-kit.ts'
import { asJson } from '../json.ts'
import { isoDay } from '../interventions.ts'
import { estimatedAge, readProfile } from '../profile.ts'
import { eligibility, grantConsent, withdrawConsent, type PersonFacts } from './consent-flow.ts'
import { loadStudies, loadStudy, publicQuestions } from './manifest.ts'
import { designNOf1, publicNOf1, seasonIdOnDisk, storeNOf1, type WearableDay } from './nof1.ts'
import { armsFromOutcomes, logOutcome, readOutcomes } from './outcomes.ts'

function answersOf(value: unknown): Array<{ id: string; choice: number }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    const item = row as { id?: unknown; choice?: unknown }
    return typeof item.id === 'string' && typeof item.choice === 'number' ? [{ id: item.id, choice: item.choice }] : []
  })
}

export function registerScienceTools(ctx: Context, deps: CoreDeps): void {
  const person = (): PersonFacts => {
    const saved = readProfile(deps.dataDir())
    const flags = deps.memory.safetyFlags()
    return {
      age: saved.age ?? estimatedAge(saved.birthYear, new Date().getFullYear()),
      sex: saved.sex,
      conditions: flags.conditions,
      drug_classes: flags.drug_classes.filter((row) => row !== 'other'),
    }
  }
  const wearable = (): WearableDay[] => readJson<WearableDay[]>(join(deps.dataDir(), 'science', 'wearable.json'), (raw) => Array.isArray(raw) ? raw as WearableDay[] : [], () => [])

  ctx.tools.register(defineTool({
    name: 'list_studies',
    description: 'List LongPi studies the person can join on this computer. Simulated mode only. Does not include their name or raw labs.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => true,
    async execute() {
      const studies = loadStudies().filter((row) => row.verify.ok).map((row) => ({
        id: row.manifest.id,
        title_zh: row.manifest.title_zh,
        summary_zh: row.manifest.summary_zh,
        kind: row.manifest.kind,
        ethics_zh: row.manifest.ethics.approval_id ? '已有批件' : 'live 未开放',
      }))
      return asJson({ ok: true, studies, page: '/api/longpi/science/community?view=page', say_zh: '研究在这台电脑上进行。原始化验和姓名不会送出。参加前要先通过理解测验。' })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'explain_study',
    description: 'Explain one study in the words of its consent text. Do not add promises. Do not reveal which comprehension answer is correct.',
    parameters: { study_id: { type: 'string', required: true } },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const study = loadStudy(String(args.study_id ?? ''))
      if (!study || !study.verify.ok) return asJson({ ok: false, error: '没有这项研究，或说明未通过校验' })
      return asJson({
        ok: true,
        study_id: study.manifest.id,
        title_zh: study.manifest.title_zh,
        text_zh: study.text_zh,
        questions: publicQuestions(study.manifest),
        say_zh: '请用上面的说明向对方解释，不要另加承诺。理解测验由系统批改，不要告诉对方哪一项是对的。',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'design_n_of_1',
    description: 'Design a personal ABAB or crossover on this person\'s own wearable data. The result stays on this computer. Never say a walk proved or cured anything.',
    parameters: {
      question: { type: 'string', description: 'What they want to compare, in their words.' },
      design: { type: 'string', enum: ['abab', 'crossover'] },
    },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const dataDir = deps.dataDir()
      const outcomes = readOutcomes(dataDir)
      const seasonId = seasonIdOnDisk(dataDir)
      const designed = designNOf1({
        today: isoDay(),
        design: args.design === 'crossover' ? 'crossover' : 'abab',
        question_zh: typeof args.question === 'string' ? args.question : '',
        wearable: wearable(),
        glucose: armsFromOutcomes(outcomes) as { morning: number[]; after_dinner: number[] },
        season_id: seasonId,
      })
      const stored = storeNOf1(dataDir, designed)
      if (stored.completed) {
        deps.bus.emit('study.n_of_1_completed', { study_id: 'n-of-1', season_id: seasonId }, { module: 'M8', via: 'tool', tool: 'design_n_of_1', session_id: sessionOfExec(exec) })
      }
      return asJson({ ok: true, ...publicNOf1(designed), say_zh: '把 protocol_zh 和 result_zh 用你自己的话讲短一点，不要添加数字，不要说证明或治愈。种子留在这台电脑上。' })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'log_n_of_1_outcome',
    description: 'Store one outcome the person just said (a walk and a glucose). Pass their sentence as quote. The number is parsed from that sentence, not invented.',
    parameters: {
      quote: { type: 'string', required: true, description: 'Their exact sentence, e.g. 晚饭后走了20分钟，血糖 6.4' },
      study_id: { type: 'string' },
    },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const quote = typeof args.quote === 'string' ? args.quote : ''
      const dataDir = deps.dataDir()
      const saved = logOutcome(dataDir, quote, isoDay(), typeof args.study_id === 'string' ? args.study_id : null, newId('outcme'), new Date().toISOString())
      if (!saved) return asJson({ ok: false, error: '这句话里没有走路时段、分钟数或血糖数字' })
      const seasonId = seasonIdOnDisk(dataDir)
      const prev = readJson<{ design?: string }>(join(dataDir, 'science', 'n-of-1.json'), (raw) => raw as { design?: string }, () => ({}))
      const seed = readJson<{ seed?: string }>(join(dataDir, 'science', 'n-of-1-seed.json'), (raw) => raw as { seed?: string }, () => ({}))
      const designed = designNOf1({
        today: isoDay(),
        design: prev.design === 'crossover' ? 'crossover' : 'abab',
        seed: typeof seed.seed === 'string' ? seed.seed : undefined,
        wearable: wearable(),
        glucose: armsFromOutcomes(readOutcomes(dataDir)) as { morning: number[]; after_dinner: number[] },
        season_id: seasonId,
      })
      const stored = storeNOf1(dataDir, designed)
      if (stored.completed) {
        deps.bus.emit('study.n_of_1_completed', { study_id: 'n-of-1', season_id: seasonId }, { module: 'M8', via: 'tool', tool: 'log_n_of_1_outcome', session_id: sessionOfExec(exec) })
      }
      return asJson({ ok: true, saved: { day: saved.day, arm: saved.arm, value: saved.value, unit: saved.unit, minutes: saved.minutes }, stopping: designed.stopping.decision, say_zh: '已记在这台电脑上。' })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'record_study_consent',
    description: 'Record that the person agrees to one study, after they pass the comprehension check. Requires their approval. Answers are graded in code; a failed check is not consent.',
    parameters: {
      study_id: { type: 'string', required: true },
      answers: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, choice: { type: 'number' } } }, description: 'Their chosen option index for each question.' },
    },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const study = loadStudy(String(args.study_id ?? ''))
      if (!study || !study.verify.ok || !study.consent_hash_ok) return asJson({ ok: false, error: '研究说明不可用' })
      const facts = person()
      const fit = eligibility(study.manifest, facts)
      if (!fit.ok) return asJson({ ok: false, error: fit.reason_zh })
      const granted = grantConsent({
        dataDir: deps.dataDir(),
        manifest: study.manifest,
        manifest_sha256: study.sha256,
        answers: answersOf(args.answers),
        confirm: true,
        explained_by: 'agent',
        session_id: sessionOfExec(exec),
        mode: 'simulated',
      })
      if (!granted.ok) return asJson({ ok: false, error: granted.reason_zh, comprehension: granted.comprehension, questions: publicQuestions(study.manifest) })
      deps.bus.emit('study.consented', { study_id: study.manifest.id, consent_id: granted.consent.id }, { module: 'M8', via: 'tool', tool: 'record_study_consent', session_id: sessionOfExec(exec) })
      deps.invalidate()
      return asJson({ ok: true, consent_id: granted.consent.id, say_zh: '已记下同意。原始化验不会离开这台电脑。' })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'withdraw_from_study',
    description: 'Withdraw the person from a study. Deletes shares that were not released. They can withdraw any time.',
    parameters: { study_id: { type: 'string', required: true } },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const study = loadStudy(String(args.study_id ?? ''))
      if (!study) return asJson({ ok: false, error: '没有这项研究' })
      const done = withdrawConsent(deps.dataDir(), study.manifest)
      if (!done.ok) return asJson({ ok: false, error: done.reason_zh })
      deps.bus.emit('study.withdrawn', { study_id: study.manifest.id, consent_id: done.consent.id }, { module: 'M8', via: 'tool', tool: 'withdraw_from_study', session_id: sessionOfExec(exec) })
      deps.invalidate()
      return asJson({ ok: true, deleted_unreleased: done.deleted, released_stays: true, statement_zh: done.statement_zh, say_zh: done.statement_zh })
    },
  }))

  }
