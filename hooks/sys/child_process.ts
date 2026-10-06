// node:child_process. `spawn` runs the command through the engine: the in-memory files are written out
// first (a method script reads what the core staged), the command runs to its end, and its working
// directory is read back in (the script's out/ files). The synchronous forms cannot wait in a mod and
// answer as a command that could not start.

import { Buffer } from './buffer.ts'
import { EventEmitter } from './events.ts'
import { host } from './host.ts'
import { vfs } from './vfs.ts'

type SpawnOptions = { cwd?: string; env?: Record<string, string | undefined>; shell?: boolean; stdio?: unknown; timeout?: number; detached?: boolean }

export class ChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  stdin = { write: (_chunk: unknown) => true, end: () => undefined }
  pid = 0
  exitCode: number | null = null
  killed = false
  kill(_signal?: string): boolean {
    this.killed = true
    return true
  }
  unref(): void {}
}

function cleanEnv(env: SpawnOptions['env']): Record<string, string> | undefined {
  if (!env) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) if (typeof value === 'string') out[key] = value
  return out
}

export function spawn(command: string, args: readonly string[] = [], options: SpawnOptions = {}): ChildProcess {
  const child = new ChildProcess()
  void (async () => {
    const io = host().io
    await vfs.flush(io)
    const result = await io.run([command, ...args], { cwd: options.cwd, env: cleanEnv(options.env), timeoutMs: Math.min(600_000, options.timeout ?? 180_000) })
    if (options.cwd) await vfs.ensure(io, options.cwd, { recursive: true, maxBytes: 4 * 1024 * 1024 }).catch(() => undefined)
    if (child.killed) return
    child.exitCode = result.exitCode
    if (result.stdout) child.stdout.emit('data', Buffer.from(result.stdout))
    if (result.stderr) child.stderr.emit('data', Buffer.from(result.stderr))
    child.emit('exit', result.exitCode, null)
    child.emit('close', result.exitCode, null)
  })().catch((error: unknown) => {
    child.emit('error', error instanceof Error ? error : new Error(String(error)))
  })
  return child
}

export type SpawnSyncReturns = { status: number | null; stdout: string; stderr: string; error?: Error; signal: null; pid: number; output: unknown[] }

export function spawnSync(command: string, _args: readonly string[] = [], _options: unknown = {}): SpawnSyncReturns {
  const error = new Error(`${command} cannot run synchronously in the LongPi mod`) as Error & { code: string }
  error.code = 'ENOSYS'
  return { status: null, stdout: '', stderr: '', error, signal: null, pid: 0, output: [] }
}

export function execFileSync(command: string, _args: readonly string[] = [], _options: unknown = {}): never {
  throw new Error(`${command} cannot run synchronously in the LongPi mod`)
}

/** The async form the mod's own code uses. */
export async function run(argv: readonly string[], options: { cwd?: string; env?: Record<string, string>; timeoutMs?: number; stdin?: string } = {}) {
  const io = host().io
  await vfs.flush(io)
  return io.run(argv, options)
}
