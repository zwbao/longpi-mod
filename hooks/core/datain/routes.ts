import { Buffer } from '../../sys/buffer.ts'
// Page routes for M7: upload (chunked, a server path, or pasted text), findings, meds, conditions,
// and Mirobody login that mints the personal MCP URL (no copy-paste).

import { randomBytes } from '../../sys/crypto.ts'
import { resolveRootDir } from '../paths.ts'
import { renewActiveMember } from '../people/mirobody.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { connectionUrlProblem, loginMirobody, maskMcpUrl, saveConnection, testConnection } from '../connection.ts'
import { listConditions, rememberCondition } from './conditions.ts'
import { readGenetics } from './genetics.ts'
import { listMedications, rememberMedication } from './meds.ts'
import { isStoreKind, readStored, storeIsOn } from '../stores/index.ts'
import { STORE_KINDS } from '../stores/limits.ts'
import { findingsFromIndicators, listFindings } from './narrative.ts'
import { ingestDocument, type SocketOpener } from './upload.ts'

const CHUNK_RAW = 24 * 1024
const MAX_FILE = 32 * 1024 * 1024

interface Pending {
  filename: string
  contentType: string
  size: number
  chunks: Map<number, Buffer>
  total: number
  at: number
  type?: 'methylation' | 'taxa' | 'proteins' | 'conditions'
  confirm: boolean
  sample_date?: string
  site?: 'gut' | 'oral'
  panel?: string
  lab_name?: string
  method?: string
  analyser?: string
}

function uploadFields(value: Record<string, unknown>): {
  type?: 'methylation' | 'taxa' | 'proteins' | 'conditions'
  confirm: boolean
  sample_date?: string
  site?: 'gut' | 'oral'
  panel?: string
  lab_name?: string
  method?: string
  analyser?: string
} {
  const type = isStoreKind(value.type) ? value.type : undefined
  const site = value.site === 'gut' || value.site === 'oral' ? value.site : undefined
  const sample = typeof value.sample_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.sample_date) ? value.sample_date : undefined
  const panel = typeof value.panel === 'string' && value.panel.trim() ? value.panel.trim().slice(0, 40) : undefined
  const lab_name = typeof value.lab_name === 'string' ? value.lab_name : undefined
  const method = typeof value.method === 'string' ? value.method : undefined
  const analyser = typeof value.analyser === 'string' ? value.analyser : undefined
  return {
    ...(type ? { type } : {}),
    confirm: value.confirm === true,
    ...(sample ? { sample_date: sample } : {}),
    ...(site ? { site } : {}),
    ...(panel ? { panel } : {}),
    ...(lab_name ? { lab_name } : {}),
    ...(method ? { method } : {}),
    ...(analyser ? { analyser } : {}),
  }
}

function fromPending(row: Pending) {
  return {
    ...(row.type ? { type: row.type } : {}),
    confirm: row.confirm,
    ...(row.sample_date ? { sample_date: row.sample_date } : {}),
    ...(row.site ? { site: row.site } : {}),
    ...(row.panel ? { panel: row.panel } : {}),
    ...(row.lab_name ? { lab_name: row.lab_name } : {}),
    ...(row.method ? { method: row.method } : {}),
    ...(row.analyser ? { analyser: row.analyser } : {}),
  }
}

const pending = new Map<string, Pending>()

function bodyOf(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
}

function fail(error: string, status = 400): { ok: false; status: number; error: string } {
  return { ok: false, status, error }
}

export function registerDatainRoutes(deps: CoreDeps, open?: SocketOpener): void {
  deps.http.route('GET', '/api/longpi/findings', async () => {
    const dataDir = deps.dataDir()
    try {
      const context = await deps.context()
      findingsFromIndicators(dataDir, context.records.indicators)
    } catch {
      // The list below is whatever was already stored.
    }
    const findings = listFindings(dataDir).slice().reverse()
    return {
      ok: true,
      findings: findings.map((row) => ({
        id: row.id, date: row.date, kind: row.kind, text_zh: row.text_zh, grade: row.grade ?? '',
        ...(row.page_note_zh ? { page_note_zh: row.page_note_zh } : {}),
      })),
      genetics: readGenetics(dataDir),
    }
  })

  deps.http.route('GET', '/api/longpi/meds', async () => {
    const listed = listMedications(deps.dataDir())
    return { ok: true, lines: listed.lines, medications: listed.rows }
  })

  deps.http.route('POST', '/api/longpi/meds', async (_req, body) => {
    const value = bodyOf(body)
    const name = typeof value.name === 'string' ? value.name : ''
    const saved = rememberMedication(deps.dataDir(), {
      name,
      dose_text: typeof value.dose_text === 'string' ? value.dose_text : '',
      frequency_text: typeof value.frequency_text === 'string' ? value.frequency_text : '',
      since: typeof value.since === 'string' ? value.since : '',
    })
    if (!saved.ok) return fail(saved.error)
    return { ok: true, read_back: saved.read_back, ...listMedications(deps.dataDir()) }
  })

  deps.http.route('GET', '/api/longpi/conditions', async () => ({ ok: true, conditions: listConditions(deps.dataDir()) }))

  deps.http.route('POST', '/api/longpi/conditions', async (_req, body) => {
    const value = bodyOf(body)
    const name = typeof value.name_zh === 'string' ? value.name_zh : ''
    const state = value.state === 'past' || value.state === 'suspected' || value.state === 'ruled_out' || value.state === 'current' ? value.state : 'current'
    const saved = rememberCondition(deps.dataDir(), {
      name_zh: name,
      state,
      since: typeof value.since === 'string' ? value.since : '',
      quote_zh: typeof value.quote === 'string' ? value.quote : '',
      via: 'page',
    })
    if (!saved.ok) return fail(saved.error)
    return { ok: true, read_back: saved.read_back, conditions: listConditions(deps.dataDir()) }
  })

  deps.http.route('POST', '/api/longpi/mirobody/login', async (_req, body) => {
    const value = bodyOf(body)
    const base = typeof value.base_url === 'string' ? value.base_url.trim() : ''
    const email = typeof value.email === 'string' ? value.email.trim() : ''
    const password = typeof value.password === 'string' ? value.password : ''
    const problem = connectionUrlProblem(base)
    if (problem) return fail(problem)
    if (!email.includes('@')) return fail('请填写邮箱。')
    if (password.length < 8) return fail('密码至少 8 位。')
    const minted = await loginMirobody({ base_url: base, email, password })
    if (!minted.ok) return fail(minted.error)
    const tested = await testConnection({ mcp_url: minted.mcp_url, mcp_token: minted.mcp_token, member: deps.config().member })
    if (!tested.ok) return fail(tested.error)
    // Always the holder's own store (the login is the holder's account); then a family member being viewed gets a fresh link.
    const root = resolveRootDir(deps.config().dataDir)
    saveConnection(root, { mcp_url: minted.mcp_url, mcp_token: minted.mcp_token })
    await renewActiveMember(root, true)
    try { deps.invalidate() } catch { /* the connection file is saved */ }
    return { ok: true, url_masked: maskMcpUrl(minted.mcp_url), indicators: tested.indicators }
  })

  deps.http.route('GET', '/api/longpi/stores', async (req) => {
    const dataDir = deps.dataDir()
    const asked = req.query.get('kind')
    if (!asked) {
      const stores: Record<string, { on: boolean; rows?: number; error?: string }> = {}
      for (const kind of STORE_KINDS) {
        if (!storeIsOn(dataDir, kind)) {
          stores[kind] = { on: false, rows: 0 }
          continue
        }
        try {
          stores[kind] = { on: true, rows: readStored(dataDir, kind).length }
        } catch (error) {
          stores[kind] = { on: true, error: error instanceof Error ? error.message : '无法读取。' }
        }
      }
      return { ok: true, stores }
    }
    if (!isStoreKind(asked)) return fail('无法识别的数据类型。')
    try {
      const rows = readStored(dataDir, asked)
      const shown = rows.slice(0, 5000)
      return { ok: true, kind: asked, on: storeIsOn(dataDir, asked), count: rows.length, truncated: rows.length > shown.length, rows: shown }
    } catch (error) {
      return fail(error instanceof Error ? error.message : '无法读取。')
    }
  })

  deps.http.route('POST', '/api/longpi/upload', async (_req, body) => {
    // The 示例档案 is for looking: nothing is uploaded into it (it is rebuilt on every open anyway).
    if (/[\\/]people[\\/]pdemolimh01[\\/]?$/.test(deps.dataDir())) {
      return { ok: false, status: 409, error: '示例档案不能上传报告。请切换到「我」，在你自己的档案中上传。' }
    }
    const value = bodyOf(body)
    const op = typeof value.op === 'string' ? value.op : 'path'
    const fields = uploadFields(value)
    if (op === 'text') {
      const text = typeof value.text === 'string' ? value.text : ''
      if (text.trim().length < 4) return fail('没有可读取的文字。')
      if (text.length > 200_000) return fail('粘贴的文字太长。请改为上传文件。')
      const result = await ingestDocument(deps, { filename: typeof value.filename === 'string' ? value.filename : 'pasted.txt', text, upload: false, ...fields })
      if (result.needs_confirm) return fail(result.error || result.read_back_zh)
      // Received but not read: shown as an error with its cause and what to do, never as a quiet「0 项」.
      if (result.ok === false && result.forwarded && result.error) return fail(result.error, 422)
      return result
    }
    if (op === 'path') {
      const path = typeof value.path === 'string' ? value.path : ''
      if (!path) return fail('没有文件路径。')
      try {
        const result = await ingestDocument(deps, { filename: path.split('/').pop() || 'report', path, open, ...fields })
        if (result.needs_confirm) return fail(result.error || result.read_back_zh)
        return result
      } catch (error) {
        return fail(error instanceof Error ? '无法读取该文件。' : '无法读取该文件。')
      }
    }
    if (op === 'start') {
      const filename = typeof value.filename === 'string' && value.filename.trim() ? value.filename.trim() : 'report'
      const size = typeof value.size === 'number' ? value.size : 0
      if (size <= 0 || size > MAX_FILE) return fail('文件为空，或超过 32 MB。基因叙述版请发送到健康对话中，请勿从网页上传整份文件。')
      const id = `up-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
      const total = Math.max(1, Math.ceil(size / CHUNK_RAW))
      pending.set(id, { filename, contentType: typeof value.content_type === 'string' ? value.content_type : 'application/octet-stream', size, chunks: new Map(), total, at: Date.now(), ...fields })
      return { ok: true, id, total }
    }
    if (op === 'chunk') {
      const id = typeof value.id === 'string' ? value.id : ''
      const row = pending.get(id)
      if (!row) return fail('上传已过期，请重新选择文件。')
      const index = typeof value.index === 'number' ? value.index : -1
      const b64 = typeof value.b64 === 'string' ? value.b64 : ''
      if (index < 0 || index >= row.total || !b64) return fail('该文件分段不完整。')
      const buf = Buffer.from(b64, 'base64')
      if (buf.length > CHUNK_RAW + 8) return fail('该分段过大。')
      row.chunks.set(index, buf)
      return { ok: true, received: row.chunks.size, total: row.total }
    }
    if (op === 'finish') {
      const id = typeof value.id === 'string' ? value.id : ''
      const row = pending.get(id)
      if (!row) return fail('上传已过期，请重新选择文件。')
      if (row.chunks.size !== row.total) return fail(`尚缺 ${row.total - row.chunks.size} 段。`)
      const bytes = Buffer.concat([...row.chunks.entries()].sort((a, b) => a[0] - b[0]).map(([, buf]) => buf))
      pending.delete(id)
      const result = await ingestDocument(deps, { filename: row.filename, bytes, open, ...fromPending(row) })
      if (result.needs_confirm) return fail(result.error || result.read_back_zh)
      return result
    }
    return fail('无法识别的上传步骤。')
  })
}
