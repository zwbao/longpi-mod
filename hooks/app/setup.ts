// What LongPi needs besides the mod, set up by itself. The method library ships inside the mod (library/), and
// the weekly update puts a newer copy in ~/.longpi/longevity-skills. Most method scripts need only Python 3.9+;
// a dozen use numpy/pandas/scipy, which go into ~/.longpi/.venv in the background, through uv (fetched into
// ~/.longpi/bin when the machine has none). Nothing touches the person's shell profile.

import type { Io } from '../sys/host.ts'
import { join } from '../sys/path.ts'

export const LIBRARY_URL = 'https://github.com/zwbao/longevity-skills.git'
const PACKAGES = ['numpy>=1.21', 'pandas>=1.5', 'scipy>=1.7', 'openpyxl>=3.1']

export type Say = (line: string) => void

async function exists(io: Io, path: string): Promise<boolean> {
  return Boolean(await io.stat(path).catch(() => null))
}

export async function hasPackages(io: Io, python: string): Promise<boolean> {
  if (!python) return false
  const probe = await io.run([python, '-c', 'import sys, numpy, pandas, scipy; sys.exit(0 if sys.version_info >= (3, 9) else 1)'], { timeoutMs: 60_000 }).catch(() => null)
  return probe?.exitCode === 0
}

async function onPath(io: Io, name: string): Promise<string> {
  const out = await io.run(['/usr/bin/env', 'which', name], { timeoutMs: 10_000 }).catch(() => null)
  return out?.exitCode === 0 ? out.stdout.trim().split('\n')[0] ?? '' : ''
}

/** uv on PATH, or the copy LongPi keeps; fetched from its GitHub release when neither is there. */
async function findUv(io: Io, home: string, say: Say): Promise<string> {
  const found = await onPath(io, 'uv')
  if (found) return found
  const own = join(home, '.longpi', 'bin', 'uv')
  if (await exists(io, own)) return own
  const os = (await io.run(['uname', '-s']).catch(() => null))?.stdout.trim()
  const arch = (await io.run(['uname', '-m']).catch(() => null))?.stdout.trim()
  const target = os === 'Darwin'
    ? arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin'
    : arch === 'aarch64' || arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu'
  say('正在下载 Python 工具 uv…')
  const dir = join(home, '.longpi', 'bin')
  const archive = join(dir, 'uv.tar.gz')
  await io.run(['mkdir', '-p', dir]).catch(() => undefined)
  const got = await io.run(['curl', '-fsSL', '--retry', '2', '-o', archive, `https://github.com/astral-sh/uv/releases/latest/download/uv-${target}.tar.gz`], { timeoutMs: 300_000 }).catch(() => null)
  if (got?.exitCode !== 0) return ''
  const unpacked = await io.run(['tar', '-xzf', archive, '-C', dir, '--strip-components', '1'], { timeoutMs: 60_000 }).catch(() => null)
  await io.run(['rm', '-f', archive]).catch(() => undefined)
  return unpacked?.exitCode === 0 && (await exists(io, own)) ? own : ''
}

/** A Python with the packages the heavier method scripts use, in ~/.longpi/.venv. */
export async function ensurePython(io: Io, home: string, current: string, say: Say): Promise<{ ok: boolean; python: string; lines: string[] }> {
  const lines: string[] = []
  const note = (line: string) => {
    lines.push(line)
    say(line)
  }
  if (await hasPackages(io, current)) return { ok: true, python: current, lines }
  const venv = join(home, '.longpi', '.venv')
  const python = join(venv, 'bin', 'python')
  if (await hasPackages(io, python)) return { ok: true, python, lines }
  note('正在准备计算环境（一次，几分钟）…')
  const uv = await findUv(io, home, note)
  if (uv) {
    if (!(await exists(io, python))) {
      const made = await io.run([uv, 'venv', '--quiet', '--python', '3.12', venv], { timeoutMs: 600_000 }).catch(() => null)
      if (made?.exitCode !== 0) {
        note('没能准备 Python 3.12。')
        return { ok: false, python: '', lines }
      }
    }
    const installed = await io.run([uv, 'pip', 'install', '--quiet', '--python', python, ...PACKAGES], { timeoutMs: 600_000 }).catch(() => null)
    if (installed?.exitCode === 0) {
      note('计算环境已就绪。')
      return { ok: true, python, lines }
    }
    note(`计算用的软件包没有装好：${installed?.stderr.trim().slice(0, 160) || '网络问题'}`)
    return { ok: false, python: '', lines }
  }
  // No uv and no network for it: the system's own Python, when it is new enough to make a venv.
  for (const base of ['python3.13', 'python3.12', 'python3.11', 'python3.10']) {
    const made = await io.run([base, '-m', 'venv', venv], { timeoutMs: 300_000 }).catch(() => null)
    if (made?.exitCode !== 0) continue
    const installed = await io.run([python, '-m', 'pip', 'install', '--quiet', ...PACKAGES], { timeoutMs: 600_000 }).catch(() => null)
    if (installed?.exitCode === 0) {
      note('计算环境已就绪。')
      return { ok: true, python, lines }
    }
  }
  note('没能准备完整的计算环境：大多数方法照常能算，少数要用 numpy 的方法暂时算不了。联网后输入 /longpi setup 再试。')
  return { ok: false, python: '', lines }
}

/** The weekly library update: a fresh copy of the method library in ~/.longpi/longevity-skills. */
export async function updateLibrary(io: Io, home: string, say: Say): Promise<{ ok: boolean; changed: boolean; line: string }> {
  const library = join(home, '.longpi', 'longevity-skills')
  if (await exists(io, join(library, '.git'))) {
    const before = (await io.run(['git', '-C', library, 'rev-parse', 'HEAD']).catch(() => null))?.stdout.trim()
    const pull = await io.run(['git', '-C', library, 'pull', '--ff-only', '--quiet'], { timeoutMs: 300_000 }).catch(() => null)
    const after = (await io.run(['git', '-C', library, 'rev-parse', 'HEAD']).catch(() => null))?.stdout.trim()
    if (pull?.exitCode !== 0) return { ok: false, changed: false, line: '方法库这次没有更新成功，先用现有版本。' }
    return { ok: true, changed: before !== after, line: before !== after ? '方法库已更新到最新。' : '方法库已是最新。' }
  }
  say('正在下载最新的方法库…')
  await io.run(['mkdir', '-p', join(home, '.longpi')]).catch(() => undefined)
  const clone = await io.run(['git', 'clone', '--depth', '1', '--quiet', LIBRARY_URL, library], { timeoutMs: 600_000 }).catch(() => null)
  if (clone?.exitCode !== 0) return { ok: false, changed: false, line: '最新的方法库没有下载成功，先用 LongPi 自带的版本。' }
  return { ok: true, changed: true, line: '已下载最新的方法库。' }
}

/** A library version (2026.40.0) as numbers, for picking the newer of two copies. */
export function versionKey(text: string): number[] {
  return text.trim().split('.').map((part) => Number(part) || 0)
}

export function newer(a: string, b: string): boolean {
  const x = versionKey(a)
  const y = versionKey(b)
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }
  return false
}
