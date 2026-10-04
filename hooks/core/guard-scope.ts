// LongPi's own workspaces: where its persona, page snapshot and write tools apply. Other workspaces are left as
// DSH runs them.

import { readFileSync, realpathSync } from '../sys/fs.ts'
import { join, sep } from '../sys/path.ts'
import { WORKSPACE_MARKER, WORKSPACE_TITLE } from './workspace.ts'

/** Titles of workspaces counted as LongPi's own: the one it creates, and the name 0.5.0 gave it. */
const HEALTH_WORKSPACE_TITLES = [WORKSPACE_TITLE, '健康']

export interface WorkspaceLike {
  path: string
  title?: string
}

/** LongPi's workspaces: the one it created (its marker in dataDir), and any titled 健康对话 or 健康. */
export function healthWorkspacePaths(dataDir: string, workspaces: readonly WorkspaceLike[]): string[] {
  const out = new Set<string>()
  if (dataDir) {
    try {
      const row = JSON.parse(readFileSync(join(dataDir, WORKSPACE_MARKER), 'utf8')) as { path?: unknown }
      if (typeof row.path === 'string' && row.path) out.add(row.path)
    } catch {
      // not created by LongPi, or unreadable
    }
  }
  for (const row of workspaces) {
    if (row.path && HEALTH_WORKSPACE_TITLES.includes(String(row.title ?? '').trim())) out.add(row.path)
  }
  return [...out]
}

function within(cwd: string, root: string): boolean {
  const base = root.length > 1 && root.endsWith(sep) ? root.slice(0, -1) : root
  return cwd === base || cwd.startsWith(base.endsWith(sep) ? base : `${base}${sep}`)
}

function real(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** Whether a session's working directory is the workspace or inside it, also through symlinks (macOS /var, /tmp). */
export function insideWorkspace(cwd: string, root: string): boolean {
  if (!cwd || !root) return false
  return within(cwd, root) || within(real(cwd), real(root))
}
