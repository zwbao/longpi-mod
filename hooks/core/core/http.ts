import { Buffer } from '../../sys/buffer.ts'
// Module routes (AA §3.1 rule 3): deps.http.route(method, path, handler). Every route goes through guardRoute
// (DSH's cookie and origin fence, JSON content type on writes); a handler returns a value sent as JSON, or
// { __raw } for text such as the printable doctor brief.

import type { IncomingMessage, ServerResponse } from '../../sys/http.ts'
import type { Context } from '../../sys/cordis.ts'
import type { RouteHandler } from '../contracts/index.ts'
import { guardRoute, type ConnectionGuard } from '../routes.ts'

export interface RawResponse { __raw: { status?: number; type: string; body: string; headers?: Record<string, string> } }
type Method = 'GET' | 'POST' | 'DELETE'

function readBody(req: IncomingMessage, limit = 64_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, type: string, body: string, headers: Record<string, string> = {}): void {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'no-store')
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.end(body)
}

export function isRaw(value: unknown): value is RawResponse {
  return Boolean(value) && typeof value === 'object' && '__raw' in (value as object)
}

export interface Http {
  route(method: Method, path: `/api/longpi/${string}`, handler: RouteHandler): void
  /** For tests and SSE: the raw node handler of a path (after the fence). */
  rawRoute(path: `/api/longpi/${string}`, handler: (req: IncomingMessage, res: ServerResponse) => void): void
}

export function createHttp(ctx: Context): Http {
  let lookup: (() => unknown) | null = null
  ctx.inject(['connection'], (scoped) => {
    lookup = () => (scoped as unknown as { connection?: unknown }).connection
  })
  const connection = (): ConnectionGuard | null => {
    try {
      const service = lookup?.() as Partial<ConnectionGuard> | undefined
      return service && typeof service.requestRejection === 'function' ? service as ConnectionGuard : null
    } catch {
      return null
    }
  }
  const byPath = new Map<string, Map<Method, RouteHandler>>()
  const raws = new Map<string, (req: IncomingMessage, res: ServerResponse) => void>()
  let register: ((path: string) => void) | null = null
  const registered = new Set<string>()

  const dispatch = (path: string) => (req: IncomingMessage, res: ServerResponse) => {
    const raw = raws.get(path)
    if (raw) {
      raw(req, res)
      return
    }
    const method = (req.method ?? 'GET').toUpperCase() as Method
    const handler = byPath.get(path)?.get(method)
    if (!handler) {
      send(res, 405, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: `${[...(byPath.get(path)?.keys() ?? [])].join(' or ')} only` }))
      return
    }
    void (async () => {
      let body: unknown = null
      if (method !== 'GET') {
        const text = await readBody(req)
        try {
          body = text.trim() ? JSON.parse(text) : {}
        } catch {
          send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'body must be JSON' }))
          return
        }
      }
      const url = new URL(req.url ?? path, 'http://127.0.0.1')
      const value = await handler({ method, url: url.pathname + url.search, query: url.searchParams, headers: req.headers as Record<string, unknown> }, body)
      if (isRaw(value)) send(res, value.__raw.status ?? 200, value.__raw.type, value.__raw.body, value.__raw.headers)
      else {
        const status = value && typeof value === 'object' && typeof (value as { status?: unknown }).status === 'number' && (value as { ok?: unknown }).ok === false ? (value as { status: number }).status : 200
        send(res, status, 'application/json; charset=utf-8', JSON.stringify(value ?? null))
      }
    })().catch((error: unknown) => send(res, 500, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'failed' })))
  }

  ctx.inject(['webServer'], (scoped) => {
    registered.clear()
    register = (path: string) => {
      if (registered.has(path)) return
      registered.add(path)
      scoped.webServer.register({ kind: 'exact', path, handler: guardRoute(connection, dispatch(path)) })
    }
    for (const path of new Set([...byPath.keys(), ...raws.keys()])) register(path)
  })

  return {
    route(method, path, handler) {
      const methods = byPath.get(path) ?? new Map<Method, RouteHandler>()
      methods.set(method, handler)
      byPath.set(path, methods)
      register?.(path)
    },
    rawRoute(path, handler) {
      raws.set(path, handler)
      register?.(path)
    },
  }
}
