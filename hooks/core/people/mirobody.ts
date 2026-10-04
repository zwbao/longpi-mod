// A family member's record in Mirobody: a managed member of the holder's care circle, read through a personal MCP link
// minted for that member. The holder's account token is used only to create the member, to mint (and renew) the
// link, and to upload a report into the member's record; it is never sent with the member's reads, because Mirobody
// answers a request carrying an account token as that account, whatever link it came through.

import { readConnection, saveConnection } from '../connection.ts'
import { activePerson, personDir, updatePerson, type Person } from './store.ts'

/** Links live ten days on Mirobody; renew a little before. */
export const RENEW_AFTER_MS = 7 * 24 * 3600 * 1000

export interface HolderAuth { base: string; token: string }

export function holderAuth(root: string): HolderAuth | { error_zh: string } {
  const saved = readConnection(root)
  if (saved?.mcp_url && !saved.mcp_token) {
    // Connected through a link someone set up by hand: it reads records but cannot create accounts.
    return { error_zh: '当前连接为手动填写的个人链接，无法为家人建档。可粘贴家人本人的健康数据服务个人链接。' }
  }
  if (!saved?.mcp_token || !saved.mcp_url) {
    return { error_zh: 'LongPi 尚未连接这台电脑上的健康数据服务，暂时无法为家人建档。请先在「档案」的「数据连接」中点「重新连接」。' }
  }
  try {
    const url = new URL(saved.mcp_url)
    return { base: `${url.protocol}//${url.host}`, token: saved.mcp_token }
  } catch {
    return { error_zh: '无法读取已保存的数据连接，请在「档案」的「数据连接」中点「重新连接」。' }
  }
}

async function post(base: string, path: string, token: string, body: unknown, fetchImpl: typeof fetch): Promise<{ code?: number; msg?: string; data?: Record<string, unknown> }> {
  const res = await fetchImpl(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({})) as { code?: number; msg?: string; data?: Record<string, unknown> }
  if (!res.ok || json.code !== 0) throw new Error(String(json.msg ?? `HTTP ${res.status}`).slice(0, 160))
  return json
}

export async function createManagedMember(auth: HolderAuth, input: { name: string; sex: 'male' | 'female'; birth_year: number | null }, fetchImpl: typeof fetch = fetch): Promise<string> {
  // Mirobody serves managed members under /api (user_router prefix); personal links stay at /personal/mcp.
  const json = await post(auth.base, '/api/user/virtual', auth.token, {
    name: input.name, gender: input.sex, ...(input.birth_year ? { birth: `${input.birth_year}-01-01` } : {}),
  }, fetchImpl)
  const id = String(json.data?.id ?? '')
  if (!/^\d+$/.test(id)) throw new Error('健康数据服务未返回家人编号')
  return id
}

export async function mintMemberLink(auth: HolderAuth, memberId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const json = await post(auth.base, '/personal/mcp', auth.token, { user_id: memberId }, fetchImpl)
  const url = String(json.data?.url ?? '')
  if (!/^https?:\/\//.test(url)) throw new Error('健康数据服务未返回家人链接')
  return url
}

/** Save the member's link in their own store, with no token (see the header). */
export function saveMemberLink(root: string, person: Person, url: string, now = new Date()): void {
  saveConnection(personDir(root, person.id), { mcp_url: url, mcp_token: '' }, now)
  updatePerson(root, person.id, { link_minted_at: now.toISOString() })
}

/**
 * Renew a member's link when it is old or missing (or always, with `force`). Returns an error to show, or '' when the
 * link is fine. The error is kept on the person so the page can show it.
 */
export async function ensureMemberLink(root: string, person: Person, fetchImpl: typeof fetch = fetch, now = new Date(), force = false): Promise<string> {
  if (!person.mirobody_user_id) return ''
  const minted = Date.parse(person.link_minted_at ?? '')
  const saved = readConnection(personDir(root, person.id))
  if (!force && saved?.mcp_url && Number.isFinite(minted) && now.getTime() - minted < RENEW_AFTER_MS) return ''
  const auth = holderAuth(root)
  let error = ''
  if ('error_zh' in auth) error = `${person.label_zh}的链接需要续期：${auth.error_zh}`
  else {
    try {
      saveMemberLink(root, person, await mintMemberLink(auth, person.mirobody_user_id, fetchImpl), now)
    } catch (e) {
      error = `${person.label_zh}的链接续期失败：${e instanceof Error ? e.message : String(e)}。请在「档案」的「数据连接」中点「重新连接」。`
    }
  }
  updatePerson(root, person.id, { link_error: error })
  return error
}

let lastCheck = 0
/**
 * The member being viewed keeps a live link: checked at most every ten minutes on any read, so a page left open or a
 * restart past day ten renews it instead of failing (and never falls back to the holder's own access).
 */
export async function renewActiveMember(root: string, force = false, fetchImpl: typeof fetch = fetch): Promise<string> {
  const person = activePerson(root).person
  if (!person) return ''
  if (!force && Date.now() - lastCheck < 10 * 60_000) return person.link_error ?? ''
  lastCheck = Date.now()
  return ensureMemberLink(root, person, fetchImpl, new Date(), force)
}
