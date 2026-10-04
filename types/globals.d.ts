// Node globals the ported core calls. sys/timers.ts installs them on the engine's clock at session start.
declare function setTimeout(fn: (...args: any[]) => void, ms?: number, ...args: any[]): any
declare function clearTimeout(id: any): void
declare function setInterval(fn: (...args: any[]) => void, ms?: number, ...args: any[]): any
declare function clearInterval(id: any): void
declare function setImmediate(fn: (...args: any[]) => void): any
interface AbortSignal {
  addEventListener(type: 'abort', listener: () => void): void
  readonly reason?: unknown
}
declare function queueMicrotask(fn: () => void): void
declare const console: { log: (...a: unknown[]) => void; info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void; debug: (...a: unknown[]) => void }
interface FetchResponse { status: number; ok: boolean; statusText: string; url: string; headers: { get(name: string): string | null; has(name: string): boolean }; text(): Promise<string>; json(): Promise<any>; arrayBuffer(): Promise<ArrayBuffer> }
declare function fetch(input: string | URL | { url: string }, init?: { method?: string; headers?: Record<string, string> | Array<[string, string]>; body?: string | null; signal?: AbortSignal; redirect?: string }): Promise<FetchResponse>
declare const WebSocket: any
