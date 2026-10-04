import type { Context } from '../sys/cordis.ts'
import { loadCatalog } from './catalog.ts'
import { coachSkillVersion } from './coach.ts'
import type { Config } from './config.ts'
import { matchSkills } from './match.ts'
import type { MountState } from './mirobody.ts'
import { clampMatches, resolveDataDir, resolveSkillsHome } from './paths.ts'
import { readProfile } from './profile.ts'
import { readReceipts } from './runner.ts'
import { writeStats } from './stats.ts'
import { stageNow } from './journey.ts'
import { readFollowup } from './followup.ts'
import { PRODUCT_NAME, PRODUCT_VERSION } from './version.ts'

function argsOf(raw: string, name: string): string {
  const text = raw.trim().replace(/^\//, '')
  if (text === name) return ''
  if (text.startsWith(`${name} `)) return text.slice(name.length).trim()
  return text
}

export function registerCommands(ctx: Context, config: () => Config, mount: MountState): void {
  ctx.inject(['commands'], (scoped) => {
    scoped.commands.register({
      name: 'longpi',
      description: '打印 LongPi 摘要（给安装的人看）：方法库版本、档案、体检记录是否连上、现在走到哪一步、提醒是否打开。不含化验数字。',
      handler: () => {
        const current = config()
        const home = resolveSkillsHome(current.skillsHome)
        const catalog = loadCatalog(home)
        const profile = readProfile(resolveDataDir(current.dataDir))
        const stage = stageNow(profile, Boolean(current.mcpUrl.trim()))
        const lines = [
          `${PRODUCT_NAME} ${PRODUCT_VERSION}`,
          catalog.error
            ? `skills unavailable: ${catalog.error}`
            : `skills ${catalog.cards.length} (personal ${catalog.cards.filter((card) => card.tier !== 'C').length})  version ${catalog.version || 'unversioned'}  revision ${catalog.revision || 'unknown'}  from ${catalog.source}`,
          `profile age ${profile.age ?? 'unset'}  sex ${profile.sex}  birth ${profile.birthYear ?? 'unset'}`,
          mount.mounted
            ? `mirobody mounted${mount.peer ? ' (already loaded beside this plugin)' : ''}`
            : `mirobody not mounted: ${mount.error || 'checkout missing'}`,
          current.mcpUrl.trim() ? 'record server configured' : 'record server not configured',
          `stage ${stage.stage ?? 'unknown'} · next ${stage.title_zh}`,
          `followup ${readFollowup(resolveDataDir(current.dataDir)).enabled ? 'on' : 'off'}`,
          current.coach === false ? 'coach off (LongPi voice)' : `coach Pi on · skill ${coachSkillVersion() ?? 'not installed'}`,
        ]
        const last = readReceipts(resolveDataDir(current.dataDir), 1)[0]
        if (last) lines.push(`last skill ${last.skill}  ok ${last.ok}`)
        return { kind: catalog.error ? 'error' : 'success', text: lines.join('\n') }
      },
    })
    scoped.commands.register({
      name: 'longpi-skills',
      description: '按一句话匹配长寿技能。例：/longpi-skills 表型年龄',
      handler: (invocation: { rawInput: string }) => {
        const question = argsOf(invocation.rawInput, 'longpi-skills')
        const current = config()
        const catalog = loadCatalog(resolveSkillsHome(current.skillsHome))
        if (catalog.error) return { kind: 'error', text: catalog.error }
        const matched = matchSkills(catalog.cards, question, [], clampMatches(current.maxSkillMatches), { intents: catalog.intents })
        if (matched.matches.length === 0) return { kind: 'success', text: matched.note }
        const lines = matched.matches.map((item) => `${item.name}  ${item.why.join('；') || item.domain}`)
        return { kind: 'success', text: lines.join('\n') }
      },
    })
    scoped.commands.register({
      name: 'longpi-stats',
      description: '把最近 7 天的匿名运行统计写到本地文件：技能名、是否跑完、失败原因和缺了哪些输入。不含任何数值。',
      handler: () => {
        const path = writeStats(resolveDataDir(config().dataDir))
        return { kind: 'success', text: `wrote ${path}\nIt holds counts only. Share it with the skill maintainers if you want to.` }
      },
    })
    scoped.commands.register({
      name: 'longpi-version',
      description: '打印 dsh-plugin-longpi 版本。',
      handler: () => ({ kind: 'success', text: `${PRODUCT_NAME} ${PRODUCT_VERSION}` }),
    })
  })
}
