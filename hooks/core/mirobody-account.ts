import { Buffer } from '../sys/buffer.ts'
// LongPi pairs itself with the Mirobody on this computer: the person never sees an address, an email or a
// password. On first use it registers a local account (a local Mirobody sends no mail, so registering signs in),
// keeps the generated credentials in the LongPi home (0600), mints the personal link and saves the connection.
// When the saved account token nears its 30-day expiry it signs in again with those credentials.
//
// Only a Mirobody on this computer is paired this way: a remote address is never given an account nobody asked
// for. A connection the installer or the person set up by hand (a link without an account) is left alone.

import { randomBytes } from '../sys/crypto.ts'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from '../sys/fs.ts'
import { join } from '../sys/path.ts'
import { readConnection, saveConnection } from './connection.ts'

export const ACCOUNT_FILE = 'mirobody-account.json'
const RENEW_BEFORE_MS = 5 * 24 * 3600_000
const CHECK_EVERY_MS = 10 * 60_000

export interface LocalAccount { base: string; email: string; password: string; created_at: string }

export type PairResult =
  | { status: 'paired' | 'renewed' | 'ok' }
  | { status: 'skipped'; why: 'not_local' | 'manual_connection' | 'remote_connection' | 'own_login' }
  | { status: 'error'; error_zh: string }

/** The service answered and refused (an account it no longer knows, a bad request): not a service that is down. */
class Refused extends Error {}

export function isLocalBase(base: string): boolean {
  try {
    const host = new URL(base).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1'
  } catch {
    return false
  }
}

export function readAccount(root: string): LocalAccount | null {
  try {
    const v = JSON.parse(readFileSync(join(root, ACCOUNT_FILE), 'utf8')) as Partial<LocalAccount>
    return typeof v.base === 'string' && typeof v.email === 'string' && typeof v.password === 'string'
      ? { base: v.base, email: v.email, password: v.password, created_at: String(v.created_at ?? '') }
      : null
  } catch {
    return null
  }
}

function writeAccount(root: string, account: LocalAccount): void {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeFileSync(join(root, ACCOUNT_FILE), `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 })
}

/** Milliseconds since epoch when a JWT expires; null when it carries no readable exp. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

async function call(fetchImpl: typeof fetch, url: string, body: unknown, token?: string): Promise<{ code?: number; msg?: string; data?: Record<string, unknown> }> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json().catch(() => ({})) as { code?: number; msg?: string; data?: Record<string, unknown> }
  if (!res.ok || json.code !== 0) throw new Refused(String(json.msg ?? `HTTP ${res.status}`).slice(0, 160))
  return json
}

async function accessToken(fetchImpl: typeof fetch, account: LocalAccount, register: boolean): Promise<string> {
  const json = await call(fetchImpl, `${account.base}/password/${register ? 'register' : 'login'}`, { email: account.email, password: account.password })
  const token = json.data?.access_token
  if (typeof token !== 'string' || !token) throw new Error('no access token')
  return token
}

async function mintLink(fetchImpl: typeof fetch, base: string, token: string): Promise<string> {
  const json = await call(fetchImpl, `${base}/personal/mcp`, {}, token)
  const url = json.data?.url
  if (typeof url !== 'string' || !url.startsWith('http')) throw new Error('no personal link')
  return url
}

/**
 * Make sure the holder's store has a working connection to the local Mirobody. Never throws; safe to call often
 * (the work is done at most every ten minutes unless `force`).
 */
export async function ensureLocalPairing(
  root: string,
  opts: { base: string; configuredUrl?: string; force?: boolean; reclaim?: boolean; fetchImpl?: typeof fetch; now?: () => number },
): Promise<PairResult> {
  const now = opts.now ?? Date.now
  // Throttled: nothing is checked, and the reason a check failed stays for the page.
  if (!opts.force && now() - (lastCheck.get(root) ?? 0) < CHECK_EVERY_MS) return { status: 'ok' }
  // One pairing per LongPi home at a time (two clicks on 重新连接 must not register two accounts).
  const running = inflight.get(root)
  if (running) return running
  const run = pairOnce(root, opts).then((result) => {
    if (result.status === 'error') lastFailure.set(root, result.error_zh)
    else if (result.status !== 'skipped' || opts.reclaim) lastFailure.delete(root)
    return result
  }).finally(() => inflight.delete(root))
  inflight.set(root, run)
  return run
}

async function pairOnce(
  root: string,
  opts: { base: string; configuredUrl?: string; force?: boolean; reclaim?: boolean; fetchImpl?: typeof fetch; now?: () => number },
): Promise<PairResult> {
  const now = opts.now ?? Date.now
  lastCheck.set(root, now())
  const fetchImpl = opts.fetchImpl ?? fetch
  const base = opts.base.replace(/\/+$/, '')
  if (!isLocalBase(base)) return { status: 'skipped', why: 'not_local' }
  const saved = readConnection(root)
  let account = readAccount(root)
  // A link someone set up by hand (installer flag or pasted), with no account behind it: theirs, not ours. When the
  // person asks to reconnect (reclaim), LongPi takes over only a link to this same Mirobody without a token (an
  // installer's demo account, a pasted link); a remote link, or one they signed into with their own account, stays.
  if (opts.reclaim && saved?.mcp_url && sameHost(saved.mcp_url, base) === false) return { status: 'skipped', why: 'remote_connection' }
  const handLink = !account ? (saved?.mcp_url || (!saved ? opts.configuredUrl?.trim() ?? '' : '')) : ''
  if (handLink) {
    if (!opts.reclaim) return saved?.mcp_token ? { status: 'ok' } : { status: 'skipped', why: 'manual_connection' }
    if (sameHost(handLink, base) === false) return { status: 'skipped', why: 'remote_connection' }
    if (saved?.mcp_token) return { status: 'skipped', why: 'own_login' }
  }
  try {
    if (!opts.reclaim && saved?.mcp_url && saved.mcp_token) {
      const exp = tokenExpiry(saved.mcp_token)
      if (exp === null || exp - now() > RENEW_BEFORE_MS) return { status: 'ok' }
      if (!account) return { status: 'ok' }          // an account the person signed into themselves: kept as is
      const token = await accessToken(fetchImpl, account, false)
      saveConnection(root, { mcp_url: await mintLink(fetchImpl, account.base, token), mcp_token: token })
      return { status: 'renewed' }
    }
    let token = ''
    if (account) {
      try {
        token = await accessToken(fetchImpl, account, false)
      } catch (error) {
        // The service is up but no longer knows this account (its database was reset): pair a new one.
        if (!(error instanceof Refused)) throw error
        account = null
      }
    }
    if (!account) {
      account = {
        base,
        email: `longpi-${randomBytes(6).toString('hex')}@longpi.local`,
        password: randomBytes(18).toString('base64url'),
        created_at: new Date(now()).toISOString(),
      }
      token = await accessToken(fetchImpl, account, true)
      writeAccount(root, account)                     // only once Mirobody accepted it
    }
    saveConnection(root, { mcp_url: await mintLink(fetchImpl, account.base, token), mcp_token: token })
    return { status: 'paired' }
  } catch (error) {
    lastCheck.set(root, now() - CHECK_EVERY_MS + 60_000)   // try again in a minute, not ten
    const detail = error instanceof Error ? error.message : String(error)
    if (error instanceof Refused) return { status: 'error', error_zh: `健康数据服务拒绝了 LongPi 的请求（${detail}），请稍后重试。` }
    return { status: 'error', error_zh: `无法连接这台电脑上的健康数据服务（${detail}），服务可能未在运行。` }
  }
}

const lastCheck = new Map<string, number>()
const lastFailure = new Map<string, string>()
const inflight = new Map<string, Promise<PairResult>>()

/** Whether two addresses are the same host and port; null when one cannot be read. */
function sameHost(a: string, b: string): boolean | null {
  try {
    return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase()
  } catch {
    return null
  }
}

/** Why the last pairing with the local health data service failed, in words for the page; '' when it did not. */
export function pairingProblem(root: string): string {
  return lastFailure.get(root) ?? ''
}

/** Tests. */
export function resetPairingThrottle(): void {
  lastCheck.clear()
  lastFailure.clear()
}

export function hasAccount(root: string): boolean {
  return existsSync(join(root, ACCOUNT_FILE))
}
