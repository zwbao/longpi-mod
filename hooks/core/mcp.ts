import { PRODUCT_VERSION } from './version.ts'
import { host } from '../sys/host.ts'
import { join } from '../sys/path.ts'
import { resolveDataDir } from './paths.ts'
import { callLocalTool, readLocalRecord, RECORD_FILE, type LocalRecord } from './local-record.ts'

/** The record kept on this computer (local-record.ts) answers the MCP tools when the address is local:. */
export const LOCAL_MCP_URL = 'local:'

/** Whose record answers: the person being looked at, under the LongPi home the session runs with. */
let recordDir: () => string = () => resolveDataDir('')

/** The record is the one on this computer (set by the mod at boot): its rows are the person's own reports. */
let localRecord = false

export function recordIsLocal(): boolean {
  return localRecord
}

export function setRecordDir(fn: () => string): void {
  localRecord = true
  recordDir = fn
}

export function isLocalMcp(url: string): boolean {
  return url.trim() === '' || url.trim().startsWith(LOCAL_MCP_URL)
}

export interface McpCallResult {
  success?: boolean
  error_kind?: string
  error?: string
  hint?: string
  code?: number
  result?: unknown
  text?: string
}

function endpoint(raw: string): URL | null {
  if (isLocalMcp(raw)) return new URL('http://local.record/')
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

export function mcpHost(raw: string): string {
  return endpoint(raw)?.host ?? ''
}

function parseBody(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('empty MCP response')
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed) as unknown
  const payloads: string[] = []
  for (const line of trimmed.split('\n')) {
    if (!line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload && payload !== '[DONE]') payloads.push(payload)
  }
  if (payloads.length === 0) throw new Error('MCP response had no JSON')
  return JSON.parse(payloads[payloads.length - 1] ?? '') as unknown
}

function unwrap(message: unknown): McpCallResult {
  if (!message || typeof message !== 'object') {
    return { success: false, error_kind: 'internal', error: 'MCP response was not an object' }
  }
  const body = message as {
    error?: { code?: number; message?: string }
    result?: { content?: Array<{ type?: string; text?: string }>; structuredContent?: unknown; isError?: boolean }
  }
  if (body.error) {
    const denied = body.error.code === -32000 || /auth/i.test(body.error.message ?? '')
    return {
      success: false,
      error_kind: denied ? 'denied' : 'internal',
      error: body.error.message || 'MCP error',
      code: body.error.code,
      hint: denied
        ? 'Mirobody refused this call. Set mcpToken to the account JWT, or paste the personal MCP URL.'
        : 'The Mirobody MCP server returned an error. Do not invent the missing record.',
    }
  }
  // A tool that ran and failed answers with isError: a failed read, never an empty one.
  if (body.result?.isError === true) {
    const text = (body.result.content ?? []).filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n').trim()
    return {
      success: false,
      error_kind: 'internal',
      error: text.slice(0, 300) || 'MCP tool error',
      hint: 'The Mirobody tool reported an error. Do not invent the missing record.',
    }
  }
  const structured = body.result?.structuredContent
  if (structured !== undefined) return { success: true, result: structured }
  const content = body.result?.content
  if (Array.isArray(content)) {
    const text = content.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n')
    if (!text) return { success: true, result: body.result }
    try {
      return { success: true, result: JSON.parse(text) as unknown }
    } catch {
      return { success: true, text }
    }
  }
  return { success: true, result: body.result ?? message }
}

async function postJson(
  url: string,
  token: string,
  body: unknown,
  session: string,
  timeoutMs: number,
): Promise<{ status: number; session: string; text: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2025-06-18',
  }
  if (token.trim()) headers.authorization = `Bearer ${token.trim()}`
  if (session) headers['mcp-session-id'] = session
  void timeoutMs
  const response = await host().io.fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  return {
    status: response.status,
    session: response.headers?.['mcp-session-id'] ?? session,
    text: response.text,
  }
}

/** The record on this computer for the person shown now, or null when it cannot be read. */
export function localRecordNow(): LocalRecord | null {
  try {
    return readLocalRecord(join(recordDir(), RECORD_FILE))
  } catch {
    return null
  }
}

export async function callMcpTool(options: {
  url: string
  token: string
  name: string
  args: Record<string, unknown>
  timeoutMs: number
}): Promise<McpCallResult> {
  if (isLocalMcp(options.url)) {
    const record = readLocalRecord(join(recordDir(), RECORD_FILE))
    const answer = callLocalTool(record, options.name, options.args)
    return answer.ok ? { success: true, result: answer.result } : { success: false, error_kind: 'invalid_arguments', error: answer.error }
  }
  const target = endpoint(options.url)
  if (!target) {
    return {
      success: false,
      error_kind: 'unavailable',
      error: 'mcpUrl is empty or not http(s)',
      hint: 'Run Mirobody and set mcpUrl. The harness does not keep a second copy of the chart.',
    }
  }
  const url = target.toString()
  try {
    const init = await postJson(url, options.token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'dsh-plugin-longpi', version: PRODUCT_VERSION },
      },
    }, '', options.timeoutMs)
    if (init.status === 401 || init.status === 403) {
      return {
        success: false,
        error_kind: 'denied',
        error: `MCP HTTP ${init.status}`,
        hint: 'Set mcpToken to a Mirobody JWT, or use the personal MCP URL from Settings → MCP.',
      }
    }
    if (init.session) {
      await postJson(url, options.token, { jsonrpc: '2.0', method: 'notifications/initialized' }, init.session, options.timeoutMs)
        .catch(() => undefined)
    }
    const call = await postJson(url, options.token, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: options.name, arguments: options.args },
    }, init.session, options.timeoutMs)
    if (call.status === 401 || call.status === 403) {
      return {
        success: false,
        error_kind: 'denied',
        error: `MCP HTTP ${call.status}`,
        hint: 'The Mirobody account token was rejected.',
      }
    }
    return unwrap(parseBody(call.text))
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return {
      success: false,
      error_kind: timedOut ? 'unavailable' : 'internal',
      error: error instanceof Error ? error.message : 'MCP call failed',
      hint: timedOut
        ? 'The Mirobody server did not answer before timeoutMs.'
        : 'Could not reach mcpUrl. Do not fill the gap with guessed labs.',
    }
  }
}

export function redact(text: string, secrets: readonly string[]): string {
  let out = text
  for (const secret of secrets) {
    const trimmed = secret.trim()
    if (trimmed.length < 4) continue
    out = out.split(trimmed).join('[redacted]')
  }
  return out.slice(0, 500)
}
