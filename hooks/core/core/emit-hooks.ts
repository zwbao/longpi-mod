// Tool results → HealthEvents (AA §2.6): one tools/post-execute listener owns the map from LongPi's write
// tools to the events the dispatcher and the surfaces listen for.

import type { Context } from '../../sys/cordis.ts'
import type { Bus, HealthEventSource } from '../contracts/events.ts'
import { isoDay } from '../interventions.ts'
import { sessionKey } from '../plan-hold.ts'

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function registerEmitHooks(ctx: Context, bus: Bus): void {
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    try {
      if (result.isError) return decision
      const value = record((result as { value?: unknown }).value)
      const args = record(exec.arguments)
      const source: HealthEventSource = { module: 'M0', via: 'tool', tool: exec.name, session_id: sessionKey(exec.agent) }
      switch (exec.name) {
        case 'save_intervention_plan':
          if (args.confirm === true && value.saved === true) bus.emit('plan.saved', { version: Number(value.version ?? 0), items: Array.isArray(record(value.read_back).items) ? (record(value.read_back).items as unknown[]).length : 0 }, { ...source, module: 'M3' })
          break
        case 'log_intervention_checkin': {
          const entries = Array.isArray(value.entries) ? value.entries as Array<Record<string, unknown>> : []
          if (entries.length > 0) bus.emit('checkin.logged', { day: String(entries[0]?.date ?? isoDay()), item_ids: entries.map((row) => String(row.item ?? '')), done: typeof entries[0]?.done === 'boolean' ? entries[0].done as boolean : null }, { ...source, module: 'M3' })
          break
        }
        case 'save_self_measurement': {
          const saved = Array.isArray(value.saved) ? value.saved as Array<Record<string, unknown>> : []
          for (const row of saved) bus.emit('selfmeasure.logged', { key: String(row.key ?? ''), day: String(row.date ?? isoDay()) }, { ...source, module: 'M7' })
          break
        }
        case 'save_personal_profile':
          if (value.ok !== false) bus.emit('profile.changed', { fields: Object.keys(args) }, source)
          break
        default:
          break
      }
    } catch {
      // an event that fails to go out never changes the tool's result
    }
    return decision
  })
}
