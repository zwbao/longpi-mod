// node:http types, for the route handlers the core writes against. The routes are served in process by
// sys/web.ts; nothing listens on a port.

import { EventEmitter } from './events.ts'

export class IncomingMessage extends EventEmitter {
  method = 'GET'
  url = '/'
  headers: Record<string, string | string[] | undefined> = {}
  socket = { remoteAddress: '127.0.0.1' }
  destroyed = false
  destroy(): this {
    this.destroyed = true
    return this
  }
}

export class ServerResponse extends EventEmitter {
  statusCode = 200
  headersSent = false
  writableEnded = false
  private headerMap = new Map<string, string | number | string[]>()
  private chunks: string[] = []
  private done: ((value: { status: number; headers: Record<string, string>; body: string }) => void) | null = null

  setDone(fn: (value: { status: number; headers: Record<string, string>; body: string }) => void): void {
    this.done = fn
  }

  setHeader(name: string, value: string | number | string[]): this {
    this.headerMap.set(name.toLowerCase(), value)
    return this
  }

  getHeader(name: string): string | number | string[] | undefined {
    return this.headerMap.get(name.toLowerCase())
  }

  writeHead(status: number, headers?: Record<string, string | number> | string, more?: Record<string, string | number>): this {
    this.statusCode = status
    const map = typeof headers === 'object' ? headers : more
    for (const [key, value] of Object.entries(map ?? {})) this.setHeader(key, value)
    this.headersSent = true
    return this
  }

  flushHeaders(): void {
    this.headersSent = true
  }

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk))
    this.emit('data', chunk)
    return true
  }

  end(chunk?: string | Uint8Array): this {
    if (chunk !== undefined) this.write(chunk)
    this.writableEnded = true
    const headers: Record<string, string> = {}
    for (const [key, value] of this.headerMap) headers[key] = String(value)
    this.done?.({ status: this.statusCode, headers, body: this.chunks.join('') })
    this.emit('finish')
    this.emit('close')
    return this
  }
}

export function createServer(): never {
  throw new Error('the LongPi mod serves no port')
}

export default { IncomingMessage, ServerResponse, createServer }
