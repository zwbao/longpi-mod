// Every module's register(ctx, deps), in the merge order of AA §3.7. src/index.ts calls this once.

import type { Context } from '../sys/cordis.ts'
import type { CoreDeps } from './contracts/index.ts'
import { register as triage } from './triage/register.ts'
import { register as plan } from './plan/register.ts'
import { register as feedback } from './feedback/register.ts'
import { register as surfaces } from './surfaces/register.ts'
import { register as engage } from './engage/register.ts'
import { register as datain } from './datain/register.ts'
import { register as honesty } from './honesty/register.ts'
import { register as science } from './science/register.ts'
import { register as privacy } from './privacy/register.ts'
import { register as analysis } from './analysis/register.ts'
import { register as people } from './people/register.ts'

export const MODULES = [
  ['M9', honesty], ['M1', triage], ['M3', plan], ['M7', datain], ['M4', feedback],
  ['M5', surfaces], ['M6', engage], ['M11', privacy], ['M8', science], ['M12', analysis], ['M13', people],
] as const

export function registerModules(ctx: Context, deps: CoreDeps, log: (message: string) => void = () => {}): void {
  for (const [id, register] of MODULES) {
    try {
      register(ctx, deps)
    } catch (error) {
      log(`${id} failed to register: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
