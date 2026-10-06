// The one seam between the ported LongPi core and Claude Code. The core was written for Node inside
// DeepSeek Harness; here it runs inside a Claude Code mod, which has no Node and reaches the machine only
// through the engine. register.tsx builds an Io from the engine at session start and installs it here;
// the Node-shaped shims beside this file (fs, child_process, process, os, url) read it.

export type ListEntry = { name: string; kind: 'file' | 'directory' | 'other'; size: number; mtimeMs: number }

export type RunResult = { exitCode: number; stdout: string; stderr: string }

export type CompleteResult = { ok: true; text: string } | { ok: false; reason: string }

export type Io = {
  read: (path: string) => Promise<string>
  readBase64: (path: string) => Promise<string>
  write: (path: string, text: string) => Promise<void>
  list: (path: string) => Promise<ListEntry[]>
  stat: (path: string) => Promise<{ kind: 'file' | 'directory' | 'other'; size: number; mtimeMs: number } | null>
  run: (argv: readonly string[], init?: { cwd?: string; env?: Record<string, string>; stdin?: string; timeoutMs?: number }) => Promise<RunResult>
  fetch: (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; ok: boolean; text: string; headers?: Record<string, string> }>
  complete: (prompt: string, options?: { system?: string; maxTokens?: number; model?: string; timeoutMs?: number }) => Promise<CompleteResult>
  now: () => Promise<number>
  log: (line: string) => void
}

export type Host = {
  io: Io
  pluginRoot: string
  home: string
  env: Record<string, string>
  platform: string
  /** The clock the sync core reads (refreshed before each operation). */
  nowMs: number
}

let current: Host | null = null

export function installHost(host: Host): void {
  current = host
}

export function host(): Host {
  if (!current) throw new Error('LongPi host is not installed yet')
  return current
}

export function hasHost(): boolean {
  return current !== null
}
