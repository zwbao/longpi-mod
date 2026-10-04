import type { Context } from '../sys/cordis.ts'
import { defineTool } from '../sys/dsh-tools.ts'
import { assessBinding, lookupReceipt, saveReceipt, type BindingProfile, type RecordView } from './bind.ts'
import { commandExcerpt, loadCatalog, readSkillFile, type Catalog, type SkillCard } from './catalog.ts'
import { registerLibraryHooks, registerLibraryMount, type BindingInput, type BindingProposal, type ProvenanceKind } from './contracts/library.ts'
import { listEntries, registerLibrarySkills, setLibraryHome } from './skills-provider.ts'
import type { Config } from './config.ts'
import { matchSkills, domainSummary } from './match.ts'
import type { MountState } from './mirobody.ts'
import { clampMatches, resolveDataDir, resolveSkillsHome } from './paths.ts'
import { setClinicalFlags } from './plan-prefs.ts'
import { normalizeProfile, readProfile, writeProfile, estimatedAge, FOCUS, RISK_FACTS, type Profile } from './profile.ts'
import { loadRecords, readFlags, type RecordSnapshot } from './records.ts'
import { readReceipts, runSkill } from './runner.ts'
import { PRODUCT_VERSION } from './version.ts'
import { coachSkillVersion } from './coach.ts'
import { discoverPython, runBridgeStatus } from './bridge.ts'
import { asJson } from './json.ts'
import { memoryFor } from './core/memory.ts'
import { mcpHost } from './mcp.ts'
import { latestOutputs } from './history.ts'
import { applyVersionPin } from './pin.ts'
import { loadEvidenceLexicon, mentionedEntities } from './intents.ts'
import { runnableFrom } from './measurements.ts'
import { isoDay } from './interventions.ts'
import { buildJourneyFull, consentAccepted, stageNow, unansweredOf, within, type Journey } from './journey.ts'
import { invalidateTracking, type Tracking } from './tracking.ts'
import { latestSelf, readSelf, SELF_KEYS, SELF_SPEC } from './selfmeasure.ts'
import { notOnePersonReason } from './subject.ts'
import { alignReadouts, BODY_AGE_SKILLS } from './core/method-view.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

const PROVENANCE_KINDS = ['blood_clock', 'methylation_clock', 'abdominal_ct', 'coronary_ct', 'routine_lab', 'wearable', 'questionnaire', 'profile', 'output_of'] as const

function asProvenance(value: unknown): ProvenanceKind {
  return PROVENANCE_KINDS.includes(value as ProvenanceKind) ? value as ProvenanceKind : 'routine_lab'
}

function proposalFromRows(skill: string, rows: readonly { input_key?: string; source_row_id?: string; value?: string; unit?: string; provenance?: string; quote?: string }[] | undefined): BindingProposal | null {
  if (!rows || rows.length === 0) return null
  const inputs: Record<string, BindingInput> = {}
  for (const row of rows) {
    if (!row?.input_key) continue
    inputs[row.input_key] = {
      source_row_id: row.source_row_id || row.input_key,
      value: row.value ?? '',
      unit: row.unit ?? '',
      provenance: asProvenance(row.provenance),
      quote: row.quote || row.input_key,
    }
  }
  if (Object.keys(inputs).length === 0) return null
  return { skill, inputs }
}

function bindingViewOf(home: string, pinned: string, profile: BindingProfile, indicators: RecordView['indicators'], outputs: RecordView['outputs']): RecordView {
  return { home, pinnedVersion: pinned, profile, indicators, outputs }
}

const EVIDENCE_SKILL = 'longevity-evidence'
/** How long read_personal_situation waits for the first results before answering with the stage alone. */
const JOURNEY_DEADLINE_MS = 20_000

export function manifestSummary(card: SkillCard) {
  return {
    tier: card.tier,
    kind: card.kind,
    species: card.species,
    intents: card.intents,
    inputs_status: card.inputsStatus,
    structured_measurements: card.inputsStatus !== 'none' && Boolean(card.entry?.measurements_flag),
    inputs: card.inputs.map((spec) => ({
      key: spec.key,
      label: spec.label_zh,
      unit: spec.unit ?? '',
      also_accepts: Object.keys(spec.accept ?? {}),
      unit_required: Boolean(spec.unit_required),
      range: spec.range ?? null,
      required: spec.required,
      from: spec.from,
      ...(spec.output_of ? { output_of: spec.output_of } : {}),
      ...(spec.note_zh ? { note: spec.note_zh } : {}),
    })),
    outputs: card.outputs,
    runtime: card.entry?.runtime ?? '',
  }
}

export type LibraryResultLabel = 'verified' | 'unverified-binding' | 'evidence-only'

export interface VersionCheck {
  pinned: string
  catalog: string
  /** Null when no pin is set. */
  matches: boolean | null
  /** False only when a pin is set and the running catalog is a different version. */
  verified_allowed: boolean
  /** The proposed label after the pin is applied. Null when the caller did not propose one. */
  label: LibraryResultLabel | null
  refused_verified: boolean
  mismatch: string
  mismatch_zh: string
}

// A pinned catalog that is not the running one cannot be labelled verified.
export function versionCheck(catalog: Catalog, pinned: string, proposed?: LibraryResultLabel): VersionCheck {
  return applyVersionPin(catalog.version, pinned, proposed)
}

export function registerTools(ctx: Context, config: () => Config, mount: MountState): void {
  setLibraryHome(() => resolveSkillsHome(config().skillsHome))
  const where = () => {
    const current = config()
    return {
      skillsHome: resolveSkillsHome(current.skillsHome),
      dataDir: resolveDataDir(current.dataDir),
      current,
    }
  }

  async function situation(): Promise<{ catalog: Catalog; records: RecordSnapshot; outputs: ReturnType<typeof latestOutputs>; skillsHome: string; dataDir: string; current: Config }> {
    const { skillsHome, dataDir, current } = where()
    const catalog = loadCatalog(skillsHome)
    const records = await loadRecords(current, dataDir, mount.pluginHome)
    return { catalog, records, outputs: latestOutputs(dataDir), skillsHome, dataDir, current }
  }

  // The journey runs the result skills on a cold memo. A failure there must not take the situation read
  // down with it, and a slow runtime must not hold it past its deadline: the cheap stage answers then,
  // marked pending, and the build finishes in the background (buildTracking keeps the promise).
  async function journeyOf(input: { catalog: Catalog; records: RecordSnapshot; skillsHome: string; dataDir: string; current: Config }): Promise<JourneyRead> {
    const build = buildJourneyFull({
      config: input.current, dataDir: input.dataDir, skillsHome: input.skillsHome, catalog: input.catalog, records: input.records, today: isoDay(), mount,
    })
    build.catch(() => undefined)
    try {
      const raced = await within(build, JOURNEY_DEADLINE_MS)
      if ('value' in raced) return { ...raced.value, error: '' }
      return { journey: null, tracking: null, error: '', pending: stageNow(input.records.profile, Boolean(input.current.mcpUrl.trim())) }
    } catch (error) {
      return { journey: null, tracking: null, error: error instanceof Error ? error.message.slice(0, 300) : 'journey failed' }
    }
  }

  ctx.tools.register(defineTool({
    name: 'read_personal_situation',
    description: 'Read this person\'s saved profile, a summary of their Mirobody record (indicator names, latest values, units, medication plan), their own latest self measurements (waist, home blood pressure as a 7-day mean, weight), readouts earlier skill runs produced, which methods their record can already run, and onboarding: the stage they are at (consent, profile, records, first_result, plan, routine), the next step, unanswered profile questions, the first results (phenotypic age, China-PAR) or what blocks them, and the add-on tests that would unlock them; and record_changes: markers whose change between checkups is larger than normal within-person fluctuation, the ones to show a doctor first. Read-only. Use this before choosing a longevity skill. Absence means not on file. Do not invent a lab, a dose, or a genotype. Genetics are not listed here; name rsIDs with query_genetic_data. An estimated age from birth year is not the age to pass to a skill unless the saved age field is set.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 180000,
    isConcurrencySafe: () => true,
    async execute() {
      const input = await situation()
      const { catalog, records, outputs, current } = input
      const profile = { age: records.profile.age, sex: records.profile.sex }
      const dispatch = matchSkills(catalog.cards, '', records.indicators, clampMatches(current.maxSkillMatches), {
        intents: catalog.intents, profile, outputs, reads: readFlags(records),
      })
      const read = await journeyOf(input)
      return asJson({
        profile: records.profile,
        estimated_age_from_birth_year: records.estimated_age,
        use_saved_age: records.profile.age,
        indicators: records.indicators.slice(0, 120),
        indicator_count: records.indicators.length,
        medications: records.medications,
        medication_summary_zh: records.medication_summary_zh,
        // One body-age number (INT062 fix 2): an earlier run's body age is the page's figure, or absent.
        earlier_readouts: alignReadouts(outputs, read.journey ? read.journey.results.bioage : null),
        runnable_now: dispatch.matches.map((item) => ({ name: item.name, blurb: item.blurb })),
        almost_runnable: dispatch.near.map((item) => ({ name: item.name, missing: item.runnable.missing })),
        record_status: records.record_status,
        record_error: records.record_error,
        read_errors: records.read_errors,
        missing_reads: records.missing_reads,
        mcp: records.mcp,
        // What the record holds (checkup days, first and last date); null while it is not read.
        records_summary: read.journey?.records.summary ?? null,
        ...onboardingOf(read, records.profile, input.dataDir),
        ...recordChangesOf(read),
        ...pageOf(read, input.dataDir),
        note: 'Quote medication_summary_zh for medicines. A line starting 当前 or 你记下的 is what they take now; a line starting 较早 is not. Never say 0x/day. Never print record_status, a skill id, or a tool name. Medication doses are what the record says, not an instruction to change a dose. A missing indicator was not on file, unless record_status is partial: then read_errors says which reads failed, and an indicator in missing_reads (or any indicator, when the catalogue was cut) is unknown because it was not read. Never say such an indicator was not measured; say the read failed and suggest trying again later. Indicators named ...（自测） are measurements the person entered themselves (source self), used only when newer than the record. earlier_readouts are outputs of skills already run for this person; cite them with their date. onboarding says where the person is, the first results or what blocks them, and what to add at the next checkup.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_longevity_intents',
    description: 'List the kinds of questions the longevity library answers (biological age, methylation age, wearable and sleep, does an intervention have evidence, genes, before-and-after, …), the data each needs, and for this person which skills of each are ready to run or missing one or two inputs. Use this when the question is broad or matched nothing.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute() {
      const { catalog, records, outputs } = await situation()
      const profile = { age: records.profile.age, sex: records.profile.sex }
      const byName = new Map(catalog.cards.map((card) => [card.name, card]))
      return asJson({
        version: catalog.version,
        intents: catalog.intents.map((intent) => ({
          id: intent.id,
          label: intent.label_zh,
          description: intent.description_zh,
          data: intent.data,
          skills: intent.skills.map((name) => {
            const card = byName.get(name)
            if (!card) return { name, available: false }
            const run = runnableFrom(card, records.indicators, profile, outputs)
            return { name, tier: card.tier, blurb: card.blurb, runnable: run.status, from_record: run.record, missing: run.missing }
          }),
        })),
        note: 'Intents are a hint, not a closed list. The skill catalog lists every method. intervention_evidence questions go to query_longevity_evidence. runnable says whether every required input is there from any source; from_record says whether the record itself supplies it. Tier C is evidence.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'match_longevity_skills',
    description: 'Hint which longevity-skills fit this question. Not a closed list: a method that is absent here is still in the skill catalog and may be read and run. Tier C rows are evidence (species on the row); they are not this person\'s number. The score is a sort key, not a biological age.',
    parameters: {
      question: {
        type: 'string',
        description: 'What the person asked, in their words. Empty lists the skills this record can already run.',
      },
      intent: {
        type: 'string',
        description: 'Optional intent id from list_longevity_intents, when you already know what kind of question it is.',
      },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const { catalog, records, outputs, skillsHome, current } = await situation()
      const lexicon = loadEvidenceLexicon(skillsHome)
      const question = args.question ?? ''
      const matched = matchSkills(catalog.cards, question, records.indicators, clampMatches(current.maxSkillMatches), {
        intents: catalog.intents,
        explicitIntents: args.intent ? [args.intent] : [],
        profile: { age: records.profile.age, sex: records.profile.sex },
        outputs,
        lexicon,
        reads: readFlags(records),
      })
      return asJson({
        question,
        revision: catalog.revision,
        version: catalog.version,
        catalog_count: catalog.cards.length,
        catalog_visible: catalog.cards.length,
        catalog_error: catalog.error,
        saved_age: records.profile.age,
        sex: records.profile.sex,
        indicator_count: records.indicators.length,
        mentioned_entities: mentionedEntities(question, catalog.intents, lexicon),
        ...matched,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_longevity_skill',
    description: 'Read one longevity skill by its directory name. The name may come from the skill catalog or from match_longevity_skills. Follow that file. Do not run a skill you have not read. The manifest lists each input with its unit, accepted units and plausible range. Bind rows with bind_longevity_inputs; the harness checks units, ranges and provenance. Missing inputs stay missing. Cohort hazard ratios and experimental doses are not personal instructions. Tier C is evidence.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'Skill directory name, such as accelerated-biological-aging-risk.',
      },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const { skillsHome } = where()
      const found = readSkillFile(skillsHome, args.name)
      if ('error' in found) return asJson({ ok: false, error: found.error })
      return asJson({
        ok: true,
        name: found.card.name,
        domain: found.card.domain,
        blurb: found.card.blurb,
        has_script: Boolean(found.card.script),
        manifest: manifestSummary(found.card),
        command: commandExcerpt(found.raw),
        content: found.raw.slice(0, 30_000),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'bind_longevity_inputs',
    description: 'Check a proposed binding of record rows onto one skill\'s inputs. Does not choose the skill and does not compute a number. Units convert only with the manifest\'s factors. Ranges are checked after conversion. A methylation PhenoAge does not fill a blood phenotypic age. A bare agatston score does not fill abdominal aortic calcium. Optional rows that fail are dropped and named. A required failure leaves ok false. Pass the receipt to run_longevity_skill.',
    parameters: {
      skill: { type: 'string', required: true, description: 'Skill directory name from the catalog.' },
      inputs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            input_key: { type: 'string', required: true, description: 'Manifest input key.' },
            source_row_id: { type: 'string', description: 'Indicator name and date, a profile field, an earlier output key, or a typed-store id.' },
            value: { type: 'string', required: true, description: 'The value as recorded. Do not convert the unit.' },
            unit: { type: 'string', description: 'The unit as recorded.' },
            provenance: { type: 'string', description: 'blood_clock, methylation_clock, abdominal_ct, coronary_ct, routine_lab, wearable, questionnaire, profile, or output_of.' },
            quote: { type: 'string', description: 'The row text, unchanged.' },
          },
        },
      },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const { skillsHome, dataDir, current } = where()
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      const proposal = proposalFromRows(args.skill, args.inputs) ?? { skill: args.skill, inputs: {} }
      const view = bindingViewOf(skillsHome, current.skillsVersion, {
        age: records.profile.age,
        sex: records.profile.sex,
        risk: records.profile.risk,
      }, records.indicators, latestOutputs(dataDir))
      const report = assessBinding(proposal, view)
      const receipt = report.ok ? saveReceipt(proposal) : ''
      return asJson({
        ok: report.ok,
        label: report.label,
        issues: report.issues,
        inputs_used: report.inputs_used,
        limits_zh: report.limits_zh,
        catalog_version: report.catalog_version,
        block_reason: report.blockReason,
        receipt,
        note: 'Do not convert units yourself. Do not say 年轻 unless label is verified and the change is beyond the noise band. Tier C is evidence-only.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'run_longevity_skill',
    description: 'Run one skill\'s script after bind_longevity_inputs. Pass the receipt, or the same binding. The harness checks units, ranges and provenance again, fills age and sex from the saved profile, and adds --out. The script computes the readout. Do not calculate the formula yourself. Quote the returned excerpt, including 边界, and the label (verified, unverified-binding, or evidence-only). A methylation PhenoAge is not a blood phenotypic age. A coronary Agatston score is not abdominal aortic calcium. Tier C is evidence and is not run as this person\'s number. A refusal or non-zero exit is the answer; do not replace it with a guess. Do not say 年轻 unless the label is verified and the change is beyond the noise band.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'Skill directory name from the catalog.',
      },
      receipt: { type: 'string', description: 'Receipt from bind_longevity_inputs.' },
      binding: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            input_key: { type: 'string', required: true },
            source_row_id: { type: 'string' },
            value: { type: 'string', required: true },
            unit: { type: 'string' },
            provenance: { type: 'string' },
            quote: { type: 'string' },
          },
        },
        description: 'The same rows passed to bind_longevity_inputs.',
      },
      measurements: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            key: { type: 'string', required: true, description: 'Input key or the indicator name as the record shows it.' },
            value: { type: 'string', required: true, description: 'The value exactly as recorded.' },
            unit: { type: 'string', description: 'The unit exactly as recorded; empty only when none was recorded.' },
          },
        },
        description: 'Structured measurements for skills with structured_measurements.',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Argument vector after the script, such as ["--age","45","--biomarkers","biomarkers.csv","--out","out"].',
      },
      files: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true, description: 'File name, one segment, such as biomarkers.csv.' },
            text: { type: 'string', required: true, description: 'UTF-8 contents built from tool results.' },
          },
        },
        description: 'Measurement files the skill command names. At most 12, each at most 256KB.',
      },
      use_profile: {
        type: 'boolean',
        description: 'Fill age and sex from the saved profile when the skill declares them. Default true.',
      },
    },
    output: jsonOut,
    timeoutMs: 180000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { skillsHome, dataDir, current } = where()
      const catalog = loadCatalog(skillsHome)
      const profile = readProfile(dataDir)
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      const view = bindingViewOf(skillsHome, current.skillsVersion, {
        age: profile.age,
        sex: profile.sex,
        risk: profile.risk,
      }, records.indicators, latestOutputs(dataDir))
      const fromBinding = proposalFromRows(args.name, args.binding)
      const fromReceipt = args.receipt ? lookupReceipt(args.receipt) : null
      const measured = (args.measurements ?? []).flatMap((item: any) => {
        if (!item || typeof item.key !== 'string') return []
        return [{ input_key: item.key, source_row_id: item.key, value: String(item.value ?? ''), unit: typeof item.unit === 'string' ? item.unit : '', quote: item.key, provenance: 'routine_lab' }]
      })
      const binding = fromBinding ?? fromReceipt ?? proposalFromRows(args.name, measured)
      // Two people's labs never make one body age (INT062 fix 1): the refusal is the answer, with no number.
      const mixed = BODY_AGE_SKILLS.has(args.name) ? notOnePersonReason(profile, records.indicators) : null
      if (mixed) return asJson({ ok: false, refused: true, skill: args.name, reason_zh: mixed, how_to_read: 'Say reason_zh plainly. Do not give a body age, an age gap, or any number from this record for it.' })
      const ran = await runSkill({
        home: skillsHome,
        dataDir,
        name: args.name,
        args: args.args ?? [],
        files: (args.files ?? []).flatMap((file: any) => {
          if (!file || typeof file.name !== 'string' || typeof file.text !== 'string') return []
          return [{ name: file.name, text: file.text }]
        }),
        ...(binding ? { binding, bindingView: view } : {
          measurements: measured.map((item: any) => ({ key: item.input_key, value: item.value, unit: item.unit })),
        }),
        profile: { age: profile.age, sex: profile.sex },
        useProfile: args.use_profile !== false,
        python: current.skillPython,
        runtimes: current.skillRuntimes,
        timeoutMs: current.skillTimeoutMs,
        revision: catalog.revision,
      })
      // The page's body age is computed with the age on the checkup day. A run now may use today's age and land a
      // little off: the person is told one number, the page's.
      return asJson(BODY_AGE_SKILLS.has(args.name) ? { ...ran, body_age_how_to_read: 'For the person, quote the body age on the page (read_personal_situation → onboarding.results.bioage.phenoage), not a second figure from this run; this run may use today\'s age instead of the age on the checkup day.' } : ran)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'query_longevity_evidence',
    description: 'Look up what the papers collected in longevity-skills state about drugs, supplements, diets, genes or proteins, grouped into human studies, animal experiments and cell experiments, each with its citation. Use for "does X work", "what does research say about gene Y", or to see what the collected papers say about a medicine on the plan. It never gives a dose. Animal and cell results are not human effects.',
    parameters: {
      entities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names to look up, in any language (NMN, 二甲双胍, rapamycin, FOXO3). match_longevity_skills returns mentioned_entities you can pass here.',
      },
      include_medications: {
        type: 'boolean',
        description: 'Also look up every medicine on this person\'s plan. Default false.',
      },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { skillsHome, dataDir, current } = where()
      const catalog = loadCatalog(skillsHome)
      if (!catalog.cards.some((card) => card.name === EVIDENCE_SKILL)) {
        return asJson({ ok: false, error: `${EVIDENCE_SKILL} is not in this checkout`, hint: 'Update longevity-skills, or use the evipedia skill.' })
      }
      const entities = (args.entities ?? []).map((item: any) => String(item).trim()).filter((item: string) => item && !item.includes('..') && item.length <= 80).slice(0, 8)
      const runArgs: string[] = []
      for (const entity of entities) runArgs.push('--entity', entity)
      const files: Array<{ name: string; text: string }> = []
      if (args.include_medications) {
        const records = await loadRecords(current, dataDir, mount.pluginHome)
        const names = records.medications.map((item) => item.name).filter(Boolean)
        if (names.length > 0) {
          files.push({ name: 'meds.txt', text: `${names.join('\n')}\n` })
          runArgs.push('--medications', 'meds.txt')
        }
      }
      if (runArgs.length === 0) return asJson({ ok: false, error: 'no entity to look up', hint: 'Pass entities, or set include_medications when the plan is on file.' })
      return asJson(await runSkill({
        home: skillsHome,
        dataDir,
        name: EVIDENCE_SKILL,
        args: runArgs,
        files,
        python: current.skillPython,
        runtimes: current.skillRuntimes,
        timeoutMs: current.skillTimeoutMs,
        revision: catalog.revision,
        reportLimit: 12_000,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_longevity_domains',
    description: 'List every longevity-skill domain and the directory names in each, including tier C evidence. Nothing is hidden. Names are methods, not advice to start a method.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute() {
      const catalog = loadCatalog(where().skillsHome)
      return asJson({
        revision: catalog.revision,
        version: catalog.version,
        count: catalog.cards.length,
        catalog_visible: catalog.cards.length,
        indexed_only: 0,
        evidence_count: catalog.cards.filter((card) => card.tier === 'C').length,
        error: catalog.error,
        domains: domainSummary(catalog.cards),
        note: 'Tier C is listed. It is evidence, with the species in the skill\'s first line, and it is not run as this person\'s number.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'save_personal_profile',
    description: 'Save the display name, birth year, chronological age, sex, and the yes/no facts a risk equation needs (smoker, diabetes, blood-pressure medicine in the last two weeks, northern China, urban, family history of heart attack or stroke) that this person stated. This is the profile the skills may use. It does not write the Mirobody chart. Pass only fields the person just gave; never infer a yes/no fact from a lab value or a medicine name. When they say they are unsure or do not know a fact (不确定, 不知道), pass null for it: that clears a saved answer back to unknown, never to no. Age must be the age they stated; do not store an age you computed unless they confirmed it. Sex is female, male, other, or unknown.',
    parameters: {
      displayName: { type: 'string', description: 'Name they want on the board, at most 40 characters. Omit to leave blank.' },
      birthYear: { type: 'integer', description: 'Four-digit birth year, if they gave one.' },
      age: { type: 'integer', description: 'Chronological age they stated, 0–130.' },
      sex: { type: 'string', enum: ['female', 'male', 'other', 'unknown'], description: 'Sex they stated.' },
      focus: {
        type: 'array',
        items: { type: 'string', enum: [...FOCUS] },
        description: 'What they care about most, in their order: bioage (身体年龄), cardio (心血管), glucose (血糖), weight (体重), sleep (睡眠), plan (whether their plan works). Replaces the saved list.',
      },
      smoker: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'They smoke cigarettes now (China-PAR). null clears it: they are unsure or do not know.' },
      diabetes: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'They have diabetes: a diagnosis, fasting glucose at or above 7.0 mmol/L, or diabetes medicine (as they state it). null clears it: they are unsure or do not know.' },
      bp_treated: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'They took blood-pressure medicine in the last two weeks. null clears it: they are unsure or do not know.' },
      north: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'They live in northern China (north of the Yangtze); false for southern China. null clears it: they are unsure or do not know.' },
      urban: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'They live in a city; false for a rural area. null clears it: they are unsure or do not know.' },
      family_history: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'A parent or sibling had a heart attack or stroke. null clears it: they are unsure or do not know.' },
      pregnant: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'They said they are pregnant now. Planning a pregnancy (备孕) or breastfeeding is not this flag: leave it unset. null clears it. Never infer it.' },
      ckd: { oneOf: [{ type: 'boolean' }, { type: 'null' }], description: 'They said they have chronic kidney disease. null clears it. Never infer it from a lab.' },
    },
    output: jsonOut,
    timeoutMs: 10000,
    isConcurrencySafe: () => false,
    async execute(args) {
      if ('consent' in (args as Record<string, unknown>)) {
        return asJson({ ok: false, error: 'Consent is given by the person on the LongPi page, not in chat. Nothing was saved.' })
      }
      const dataDir = resolveDataDir(config().dataDir)
      const current = readProfile(dataDir)
      const risk = { ...current.risk }
      const unknown = new Set(current.riskUnknown ?? [])
      for (const key of RISK_FACTS) {
        const value = (args as Record<string, unknown>)[key]
        if (typeof value === 'boolean') {
          risk[key] = value
          unknown.delete(key)
        } else if (value === null) {
          // 不确定: keep it distinct from never-asked, and never store it as no.
          delete risk[key]
          unknown.add(key)
        }
      }
      const next = {
        ...current,
        displayName: args.displayName ?? current.displayName,
        birthYear: args.birthYear ?? current.birthYear,
        age: args.age ?? current.age,
        sex: args.sex ?? current.sex,
        risk,
        ...(unknown.size > 0 ? { riskUnknown: [...unknown] } : { riskUnknown: undefined }),
        focus: args.focus ?? current.focus,
        consent: current.consent,
      }
      const normalized = normalizeProfile(next)
      if (!normalized.ok) return asJson({ ok: false, error: normalized.error })
      const flags: { pregnant?: boolean | null; ckd?: boolean | null } = {}
      if (typeof args.pregnant === 'boolean' || args.pregnant === null) flags.pregnant = args.pregnant
      if (typeof args.ckd === 'boolean' || args.ckd === null) flags.ckd = args.ckd
      if (Object.keys(flags).length > 0) setClinicalFlags(dataDir, flags)
      try {
        writeProfile(dataDir, normalized.profile)
      } catch (error) {
        return asJson({ ok: false, error: error instanceof Error ? error.message : 'profile failed' })
      }
      invalidateTracking()
      return asJson({
        ok: true,
        profile: normalized.profile,
        estimated_age_from_birth_year: estimatedAge(normalized.profile.birthYear, new Date().getFullYear()),
        note: 'Saved locally for this harness. Not written to Mirobody. Use profile.age for a skill, not the estimate, unless the person confirmed the estimate. A fact they did not answer stays unknown; never save it as false.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'longpi_status',
    description: 'Report whether the longevity-skills checkout and the Mirobody engine are available, which library version is loaded, which skill runtimes are configured, and the onboarding stage (consent, profile, records, first_result, plan, routine) as last known. Use this when a skill or a record tool failed: it reads no record and runs no skill. Does not return the chart or any token. When skills.pin.matches is false, do not label a result verified; skills.pin.mismatch is the reason and skills.pin.label is what versionCheck assigns to a verified result.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute() {
      const current = config()
      const { skillsHome, dataDir } = where()
      const catalog = loadCatalog(skillsHome)
      const python = discoverPython(current.pythonBin, mount.pluginHome)
      // The stage from the saved profile and the last journey built, never a new build: this tool is for when that fails.
      const stage = stageNow(readProfile(dataDir), Boolean(current.mcpUrl.trim()))
      const needed = [...new Set(catalog.cards.map((card) => card.entry?.runtime).filter((item): item is string => Boolean(item)))]
      return asJson({
        version: PRODUCT_VERSION,
        stage: stage.stage,
        next: stage.title_zh,
        coach: { on: current.coach !== false, skill_version: coachSkillVersion() },
        skills: {
          found: Boolean(skillsHome),
          revision: catalog.revision,
          version: catalog.version,
          source: catalog.source,
          count: catalog.cards.length,
          tiers: {
            A: catalog.cards.filter((card) => card.tier === 'A').length,
            B: catalog.cards.filter((card) => card.tier === 'B').length,
            C: catalog.cards.filter((card) => card.tier === 'C').length,
            tool: catalog.cards.filter((card) => card.tier === 'tool').length,
          },
          pin: versionCheck(catalog, current.skillsVersion, 'verified'),
          runtimes: needed.map((name) => ({ name, configured: Boolean(current.skillRuntimes?.[name]?.trim()) })),
          error: catalog.error,
        },
        mirobody: {
          mounted: mount.mounted,
          peer: mount.peer,
          error: mount.error,
          engine: runBridgeStatus(mount.pluginHome, python, current.mirobodyHome, current.timeoutMs),
          mcp: {
            configured: Boolean(current.mcpUrl.trim()),
            host: mcpHost(current.mcpUrl),
            token_set: Boolean(current.mcpToken.trim()),
          },
        },
        receipts: readReceipts(dataDir, 5).map((item) => ({
          at: item.at,
          skill: item.skill,
          ok: item.ok,
          exit_code: item.exit_code,
          error_kind: item.error_kind ?? '',
        })),
      })
    },
  }))
}

/** The person's latest self measurements, as journey.self.latest lists them; read from dataDir alone. */
function selfLatestRows(dataDir: string) {
  const latest = latestSelf(readSelf(dataDir))
  return SELF_KEYS.flatMap((key) => {
    const row = latest[key]
    return row ? [{ key, label_zh: SELF_SPEC[key].label_zh, ...row }] : []
  })
}

interface JourneyRead {
  journey: Journey | null
  tracking: Tracking | null
  error: string
  /** Set when the journey did not finish in time: the stage known without running anything. */
  pending?: ReturnType<typeof stageNow>
}

const HOW_TO_READ_RESULTS = [
  'results.* numbers are model estimates from the skill scripts: say 模型估计.',
  'bioage.band_years is how far phenotypic age moves with normal within-person variation; a change inside it is not a real change.',
  'If bioage.band_missing is not empty, those inputs have no published variation and were left out, so the band is a lower bound: say the real fluctuation is larger.',
  'If band_years is null, no band is available. China-PAR (results.risk) has no band at all. Never estimate or invent a band.',
  'When a result is blocked, say blocker_zh and offer addons as tests for the next checkup.',
].join(' ')

const HOW_TO_READ_CHANGES = [
  'record_changes are changes between checkups larger than normal within-person variation plus analytical error (the reference change value, from the biological-variation table); anything smaller is not listed.',
  'When a row has ask_doctor true, say so early and plainly: name the marker and give its numbers and dates from text_zh, then advice_zh. Do not name a cause or a diagnosis, and never suggest a supplement (iron included), a drug or a dose for it.',
  'Rows with verdict better are changes beyond normal fluctuation in the good direction. Quote caveat_zh when present. Differences between labs or instruments are not included: say so when the dates may come from different places (record_changes_note_zh).',
  'record_changes_unjudged lists markers whose readings failed to read or came back cut: they were not judged. Never say they did not change; give reason_zh.',
].join(' ')

/** Changes between checkups for the model: the journey's rows without their points, and how to talk about them. */
function recordChangesOf(read: JourneyRead) {
  if (!read.journey) {
    return { record_changes: [], record_changes_how_to_read: 'Changes between checkups are still being read; do not guess them. Call read_personal_situation again later.' }
  }
  const doctor = read.journey.doctor_first
  return {
    ...(doctor.stop ? {
      doctor_first_zh: doctor.sentence_zh,
      doctor_first_how_to_read: 'Say doctor_first_zh first and plainly, before any result or plan, with its numbers, and end that reply by offering once to put the values and the questions for the doctor on one page (我可以按这些结果整理一份就诊简报), when they ask about these values, a plan or a doctor; for any other question open with one short sentence naming the values and the doctor, then answer the question itself in full. These values need a doctor first. A short safe-while-you-wait plan (walking, meal quality, sleep, less smoking or alcohol) may still be drafted; do not add fasting, a large weight-loss target, a supplement, or iron until a doctor has looked. A value below the reference range is 偏低 and one above it is 偏高: say so. Naming a low value is not a diagnosis, so never answer 不能评, 不解读 or 只报数 about it, and never say that going to a doctor is optional or a common choice to skip. Do not name a cause, and never suggest iron, a supplement, a drug or a dose.',
    } : {}),
    record_changes: read.journey.changes.map(({ points, ...row }) => ({ ...row, n_points: points.length })),
    record_changes_unjudged: read.journey.changes_unjudged,
    record_changes_note_zh: read.journey.changes_note_zh,
    record_changes_how_to_read: HOW_TO_READ_CHANGES,
  }
}

/**
 * 0.5.3: what the LongPi page shows now (the same surfaces the home and the page render), the ranked top
 * facts, what the person told LongPi before (memory) and where they stand with the doctor.
 */
function pageOf(read: JourneyRead, dataDir: string) {
  const memory = (() => {
    try {
      return memoryFor(dataDir).digest({ purpose: 'chat' })
    } catch {
      return ''
    }
  })()
  if (!read.journey?.surfaces) return { memory_zh: memory }
  const { surfaces, triage } = read.journey
  return {
    page: {
      status_zh: surfaces.status.text_zh,
      next: { kind: surfaces.next.action.kind, title_zh: surfaces.next.card.text_zh, mandatory: surfaces.next.action.mandatory },
      suggestions_zh: surfaces.suggestions.map((row) => row.prompt_zh ?? row.text_zh),
    },
    top_facts: triage.top_facts.slice(0, 5).map(({ id, kind, priority, text_zh }) => ({ id, kind, priority, text_zh })),
    method_results: (read.journey.method_results ?? []).map((row) => ({
      skill: row.skill,
      label: row.label,
      limits_zh: row.limits_zh,
      outputs: row.outputs,
      inputs_used: row.inputs_used,
    })),
    care: {
      findings: triage.findings.map(({ id, title_zh, department_zh, status }) => ({ id, title_zh, department_zh, status })),
      answers: triage.care,
      needs_sex: triage.needs_sex,
    },
    memory_zh: memory,
    page_how_to_read: 'page is what the LongPi page shows the person now; top_facts are ranked by rule. method_results is the same labeled list the page renders. Quote a number only with its label. Do not say the person got younger unless that label is verified and the change is beyond the noise band. When top_facts[0] is must_surface, say it first in one or two sentences with its numbers. Do not contradict the page silently; if it is wrong, say why and call note_page_issue. memory_zh is what they told LongPi before: do not ask it again. When care.needs_sex is true, ask their sex (the limits differ for men and women).',
  }
}

function onboardingOf(read: JourneyRead, profile: Profile, dataDir: string) {
  const { journey, error, pending } = read
  if (!journey) {
    if (!pending) return { onboarding: null, onboarding_error: error, self_measurements: [] }
    // Still computing: what is known without the record or a skill, so the conversation can go on.
    return {
      onboarding: {
        stage: pending.stage,
        next: { title_zh: pending.title_zh },
        questions_unanswered: unansweredOf(profile),
        consent_accepted: consentAccepted(profile),
        pending: true,
        how_to_read: 'The first results are still being computed (the skill scripts are slow right now). Do not guess them; say they are on the way and call read_personal_situation again later.',
      },
      self_measurements: selfLatestRows(dataDir),
    }
  }
  return {
    onboarding: {
      stage: journey.stage,
      next: journey.next,
      questions_unanswered: journey.profile.questions.filter((row) => !row.answered).map((row) => row.label_zh),
      addons: journey.addons,
      // status and blocker_zh, plus the skill outputs behind them, so the first results can be given without another call.
      results: journey.results,
      consent_accepted: journey.consent.accepted,
      how_to_read: HOW_TO_READ_RESULTS,
    },
    self_measurements: journey.self.latest,
  }
}

registerLibraryHooks({
  listSkillIndex: () => listEntries(),
  validateBinding: (proposal) => {
    const report = assessBinding(proposal)
    return { ok: report.ok, issues: report.issues }
  },
})

registerLibraryMount((ctx) => {
  const context = ctx as Context
  if (!context || typeof context.inject !== 'function') return
  registerLibrarySkills(context)
})
