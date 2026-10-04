// read_progress_feedback: the graded headlines, for the chat to quote.

import type { Context } from '../../sys/cordis.ts'
import { defineTool } from '../../sys/dsh-tools.ts'
import { loadCatalog } from '../catalog.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { asJson } from '../json.ts'
import { isoDay } from '../interventions.ts'
import { resolveDataDir, resolveSkillsHome } from '../paths.ts'
import { loadRecords } from '../records.ts'
import { buildTracking, type Tracking } from '../tracking.ts'
import type { JourneyContext } from '../journey.ts'
import { feedbackFor } from './index.ts'
import { shareCard, shareText } from './share.ts'
import { rememberFeedback } from './record.ts'

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
}

const HOW = [
  'Quote headline_zh. Do not invent a different number or a different grade.',
  'Say 你确实年轻了 only when allowed_claims contains younger. A first draw, a move inside the noise band, or a marker (not body age) never gets that sentence.',
  'Inside the band, use the progress story: which markers moved the right way, how many of N, and when to retest. Never answer with only 无法判断.',
  'Affirm a completed behaviour in the same turn.',
  'Goal lines are 模型估计. Never say 10 年死亡风险.',
].join(' ')

export async function trackingNow(deps: CoreDeps): Promise<Tracking> {
  const extra = deps as CoreDeps & { context?: () => Promise<JourneyContext> }
  if (typeof extra.context === 'function') return buildTracking(await extra.context())
  const config = deps.config()
  const dataDir = resolveDataDir(config.dataDir)
  const skillsHome = resolveSkillsHome(config.skillsHome)
  const records = await loadRecords(config, dataDir, deps.mount.pluginHome)
  return buildTracking({ config, dataDir, skillsHome, catalog: loadCatalog(skillsHome), records, today: isoDay() })
}

export function dataDirOf(deps: CoreDeps): string {
  const extra = deps as CoreDeps & { dataDir?: () => string }
  if (typeof extra.dataDir === 'function') return extra.dataDir()
  return resolveDataDir(deps.config().dataDir)
}

export function registerFeedbackTools(ctx: Context, deps: CoreDeps): void {
  ctx.tools.register(defineTool({
    name: 'read_progress_feedback',
    description: 'Evidence-graded feedback for this person: body age, marker changes, completed behaviours and goal projections. The grade is already decided. Quote headline_zh. Say 你确实年轻了 only when allowed_claims includes younger. Inside the noise band, tell which markers improved and when to retest; never reply with only 无法判断. Projections are 模型估计. Never say 10 年死亡风险.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 120000,
    isConcurrencySafe: () => true,
    async execute() {
      const tracking = await trackingNow(deps)
      const messages = feedbackFor(tracking, deps.memory)
      const share = shareCard(messages)
      rememberFeedback(dataDirOf(deps), messages, deps.bus)
      return asJson({
        messages: messages.map((row) => ({
          id: row.id,
          grade: row.grade,
          subject: row.subject,
          allowed_claims: row.allowed_claims,
          headline_zh: row.headline_zh,
          ...(row.body_zh ? { body_zh: row.body_zh } : {}),
          ...(row.retest ? { retest: row.retest } : {}),
          tone: row.tone,
        })),
        ...(share ? { share: { ...share, text_zh: shareText(share) } } : {}),
        how_to_read: HOW,
      })
    },
  }))
}
