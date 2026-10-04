// /longpi setup: what LongPi needs besides the mod. The method library (github.com/zwbao/longevity-skills,
// updated weekly with new papers) goes to ~/.longpi/longevity-skills, and a Python with the packages its
// scripts use (numpy, pandas, scipy, openpyxl) to ~/.longpi/.venv, through uv when it is there.

import type { Io } from '../sys/host.ts'
import { join } from '../sys/path.ts'

export const LIBRARY_URL = 'https://github.com/zwbao/longevity-skills.git'
const PACKAGES = ['numpy>=1.21', 'pandas>=1.5', 'scipy>=1.7', 'openpyxl>=3.1']

export type SetupStep = (line: string) => void

async function exists(io: Io, path: string): Promise<boolean> {
  return Boolean(await io.stat(path).catch(() => null))
}

async function hasPackages(io: Io, python: string): Promise<boolean> {
  if (!python) return false
  const probe = await io.run([python, '-c', 'import sys, numpy, pandas, scipy; sys.exit(0 if sys.version_info >= (3, 10) else 1)'], { timeoutMs: 60_000 }).catch(() => null)
  return probe?.exitCode === 0
}

async function which(io: Io, name: string): Promise<boolean> {
  const out = await io.run(['/usr/bin/env', 'which', name], { timeoutMs: 10_000 }).catch(() => null)
  return out?.exitCode === 0 && out.stdout.trim() !== ''
}

/** Install or update what is missing; each step reports a line. Returns the summary for the person. */
export async function runSetup(io: Io, home: string, current: { skillsHome: string; python: string }, say: SetupStep): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = []
  const note = (line: string) => {
    lines.push(line)
    say(line)
  }
  const root = join(home, '.longpi')
  const library = join(root, 'longevity-skills')
  // 1. The method library.
  if (current.skillsHome && current.skillsHome !== library) {
    note(`方法库已经在：${current.skillsHome}`)
  } else if (await exists(io, join(library, '.git'))) {
    note('正在更新方法库…')
    const pull = await io.run(['git', '-C', library, 'pull', '--ff-only', '--quiet'], { timeoutMs: 300_000 }).catch((error: unknown) => ({ exitCode: 1, stdout: '', stderr: String(error) }))
    note(pull.exitCode === 0 ? '方法库已是最新。' : `方法库没有更新成功（${pull.stderr.trim().slice(0, 160) || '网络问题'}），先用现有版本。`)
  } else {
    note('正在下载方法库（约 30 MB）…')
    await io.run(['mkdir', '-p', root]).catch(() => undefined)
    const clone = await io.run(['git', 'clone', '--depth', '1', '--quiet', LIBRARY_URL, library], { timeoutMs: 600_000 }).catch((error: unknown) => ({ exitCode: 1, stdout: '', stderr: String(error) }))
    if (clone.exitCode !== 0) {
      note(`方法库下载失败：${clone.stderr.trim().slice(0, 200) || '网络问题'}。可以稍后再运行 /longpi setup。`)
      return { ok: false, lines }
    }
    note('方法库已下载。')
  }
  // 2. Python with the packages the method scripts use.
  if (await hasPackages(io, current.python)) {
    note(`Python 已就绪：${current.python}`)
    return { ok: true, lines }
  }
  const venv = join(root, '.venv')
  const python = join(venv, 'bin', 'python')
  if (!(await exists(io, python))) {
    note('正在准备 Python 环境…')
    let made = false
    if (await which(io, 'uv')) {
      const out = await io.run(['uv', 'venv', '--quiet', '--python', '3.12', venv], { timeoutMs: 600_000 }).catch(() => null)
      made = out?.exitCode === 0
    }
    if (!made) {
      for (const base of ['python3.13', 'python3.12', 'python3.11', 'python3.10', 'python3']) {
        const out = await io.run([base, '-m', 'venv', venv], { timeoutMs: 300_000 }).catch(() => null)
        if (out?.exitCode === 0 && (await hasVersion(io, python))) {
          made = true
          break
        }
      }
    }
    if (!made) {
      note('没能准备 Python 3.10 以上的环境。装好 uv（https://docs.astral.sh/uv/）或 Python 3.12 后，再运行 /longpi setup。')
      return { ok: false, lines }
    }
  }
  note('正在安装计算用的软件包（numpy、pandas、scipy）…')
  const uv = await which(io, 'uv')
  const install = uv
    ? await io.run(['uv', 'pip', 'install', '--quiet', '--python', python, ...PACKAGES], { timeoutMs: 600_000 }).catch(() => null)
    : await io.run([python, '-m', 'pip', 'install', '--quiet', ...PACKAGES], { timeoutMs: 600_000 }).catch(() => null)
  if (install?.exitCode !== 0) {
    note(`软件包没有装好：${install?.stderr.trim().slice(0, 200) || '网络问题'}`)
    return { ok: false, lines }
  }
  note('Python 环境已就绪。')
  return { ok: true, lines }
}

async function hasVersion(io: Io, python: string): Promise<boolean> {
  const out = await io.run([python, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'], { timeoutMs: 30_000 }).catch(() => null)
  return out?.exitCode === 0
}
