import { process } from '../sys/process.ts'
import { spawnSync } from '../sys/child_process.ts'
import { existsSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'

export interface BridgeStatus {
  ok: boolean
  version?: string
  bundle?: string
  python?: string
  error?: string
}

const PYTHON_CANDIDATES = ['python3.14', 'python3.13', 'python3.12', 'python3']

export function discoverPython(configured: string, pluginHome: string): string {
  const explicit = configured.trim() || process.env.MIROBODY_PYTHON?.trim() || ''
  if (explicit) return explicit
  const venv = pluginHome ? join(pluginHome, '.venv', 'bin', 'python') : ''
  if (venv && existsSync(venv)) return venv
  for (const bin of PYTHON_CANDIDATES) {
    const found = spawnSync('/usr/bin/which', [bin], { encoding: 'utf8' })
    const path = found.stdout.trim()
    if (found.status === 0 && path && existsSync(path)) return path
  }
  return 'python3'
}

/**
 * What the Mirobody terminology bridge gets for the status check: the same list the mounted Mirobody plugin gives
 * it for every tool call (path, home, language, TMPDIR, MIROBODY_HOME; no user site-packages, no PYTHONPATH), so
 * the status says what the tools will find. Never the rest of the harness's environment (API keys, tokens). Not a
 * sandbox either.
 */
export function bridgeEnv(mirobodyHome: string): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    LANG: process.env.LANG || 'C.UTF-8',
    HOME: process.env.HOME ?? '',
    MIROBODY_HOME: mirobodyHome.trim(),
    PYTHONNOUSERSITE: '1',
    PYTHONDONTWRITEBYTECODE: '1',
  }
  for (const name of ['LC_ALL', 'TMPDIR'] as const) {
    const value = process.env[name]
    if (value) env[name] = value
  }
  return env
}

export function runBridgeStatus(
  pluginHome: string,
  python: string,
  mirobodyHome: string,
  timeoutMs: number,
): BridgeStatus {
  if (!pluginHome) return { ok: false, error: 'mirobody plugin checkout not found' }
  const script = join(pluginHome, 'bridge', 'dsh_bridge.py')
  if (!existsSync(script)) return { ok: false, error: 'mirobody bridge script is missing' }
  const result = spawnSync(python, [script], {
    input: JSON.stringify({ op: 'status' }),
    encoding: 'utf8',
    timeout: timeoutMs,
    env: bridgeEnv(mirobodyHome),
  })
  if (result.error) return { ok: false, python, error: result.error.message }
  const text = (result.stdout ?? '').trim()
  if (!text) return { ok: false, python, error: (result.stderr ?? 'bridge produced no JSON').slice(0, 300) }
  try {
    const parsed = JSON.parse(text) as BridgeStatus
    return { ...parsed, python: parsed.python || python }
  } catch {
    return { ok: false, python, error: 'bridge status was not JSON' }
  }
}
