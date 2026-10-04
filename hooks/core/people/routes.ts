// M13 routes: GET /api/longpi/people, POST /api/longpi/people (add a family member), POST /api/longpi/people/active
// (switch whose record the page and the chat look at), POST /api/longpi/people/remove.

import { existsSync, rmSync } from '../../sys/fs.ts'
import type { CoreDeps } from '../contracts/index.ts'
import { readConnection, saveConnection, connectionUrlProblem } from '../connection.ts'
import { resolveRootDir } from '../paths.ts'
import { EMPTY_PROFILE, mergeProfile, normalizeProfile, writeProfile } from '../profile.ts'
import { createManagedMember, ensureMemberLink, holderAuth, mintMemberLink, saveMemberLink } from './mirobody.ts'
import { deleteLocalStore } from '../privacy/delete.ts'
import { ensureLocalPairing } from '../mirobody-account.ts'
import { isLocalMcp, LOCAL_MCP_URL } from '../mcp.ts'
import { ensureDemoPerson, isDemo, openDemo } from '../demo/index.ts'

const holderAuthOk = (root: string) => !('error_zh' in holderAuth(root))
import { invalidateRecords } from '../records.ts'
import { invalidateTracking } from '../tracking.ts'
import { invalidateIndicators } from '../indicators.ts'
import { forgetLastBuilt } from '../journey.ts'
import { forgetLastPage } from '../surfaces/service.ts'
import { SELF, activePerson, addPerson, personDir, readRegistry, removePerson, setActive } from './store.ts'

/** Everything held in memory about the person shown before a switch. */
function forgetPersonCaches(): void {
  invalidateRecords(); invalidateTracking(); invalidateIndicators(); forgetLastBuilt(); forgetLastPage()
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function peopleView(deps: CoreDeps) {
  const root = resolveRootDir(deps.config().dataDir)
  try { ensureDemoPerson(root) } catch { /* a damaged registry is reported elsewhere; the demo just stays out */ }
  const reg = readRegistry(root)
  const holder = holderAuth(root)
  return {
    ok: true,
    active: reg.active,
    people: [
      { id: SELF, label_zh: '我', name: '', connected: Boolean(readConnection(root)?.mcp_url || deps.config().mcpUrl?.trim()), managed: false, link_error_zh: '' },
      ...reg.people.map((p) => ({ id: p.id, label_zh: p.label_zh, name: p.name, sex: p.sex, birth_year: p.birth_year,
        connected: Boolean(readConnection(personDir(root, p.id))?.mcp_url) && !p.link_error, managed: Boolean(p.mirobody_user_id),
        link_error_zh: p.link_error ?? '', ...(p.demo ? { demo: true } : {}) })),
    ],
    can_create_in_mirobody: isLocalMcp(deps.config().mcpUrl) || !('error_zh' in holder),
    // A link set in the installer's config (no saved connection) also reads records but cannot create accounts.
    create_hint_zh: isLocalMcp(deps.config().mcpUrl) || !('error_zh' in holder) ? ''
      : !readConnection(root) && deps.config().mcpUrl?.trim() ? '当前的数据连接由安装时设置，暂时无法为家人建档。请先在「档案」的「数据连接」中点「重新连接」。'
        : holder.error_zh,
  }
}

export function registerPeopleRoutes(deps: CoreDeps): void {
  deps.http.route('GET', '/api/longpi/people', async () => peopleView(deps))

  deps.http.route('POST', '/api/longpi/people', async (_req, body) => {
    const v = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const clean = (x: string) => x.replace(/[^\p{L}\p{N}·•\- ]/gu, '').trim()   // shown to the model: letters only
    const label = clean(text(v.label_zh, 12))
    const name = clean(text(v.name, 30))
    const sex = v.sex === 'male' || v.sex === 'female' ? v.sex : null
    const year = Number(v.birth_year)
    const birthYear = Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() ? year : null
    const pasted = text(v.mcp_url, 600)
    if (!label) return { ok: false, status: 400, error: '请填写称呼，例如「爸爸」「妈妈」。' }
    if (name.length < 2) return { ok: false, status: 400, error: '请填写家人的姓名（与报告一致），用于核对上传的报告是否为本人的。' }
    if (name === label) return { ok: false, status: 400, error: '姓名须与报告上的真实姓名一致，不能填写称呼。' }
    if (!sex) return { ok: false, status: 400, error: '请选择生理性别（许多计算按性别分别进行）。' }
    if (pasted && connectionUrlProblem(pasted)) return { ok: false, status: 400, error: connectionUrlProblem(pasted) }
    const root = resolveRootDir(deps.config().dataDir)
    // On the record kept on this computer a family member is a folder of their own: nothing to create elsewhere.
    const local = !pasted && isLocalMcp(deps.config().mcpUrl)
    if (!local) await ensureLocalPairing(root, { base: deps.config().mirobodyUrl ?? '', configuredUrl: deps.config().mcpUrl, force: !holderAuthOk(root) }).catch(() => undefined)
    const holder = holderAuth(root)
    // Mirobody first: a member that cannot be created there is not half-created here.
    let memberId = ''
    let link = pasted
    let linkError = ''
    if (local) link = LOCAL_MCP_URL
    else if (!pasted) {
      if ('error_zh' in holder) return { ok: false, status: 409, error: holder.error_zh }
      try {
        memberId = await createManagedMember(holder, { name, sex, birth_year: birthYear })
      } catch (error) {
        return { ok: false, status: 502, error: `暂时无法为${label}建立档案，请稍后重试。如果反复出现，请确认健康数据服务正在运行。（${error instanceof Error ? error.message : String(error)}）` }
      }
      try {
        link = await mintMemberLink(holder, memberId)
      } catch (error) {
        // The member exists in Mirobody now: keep them here too (a retry would create a second one); the link is
        // made again when they are opened.
        linkError = `${label}的链接尚未生成：${error instanceof Error ? error.message : String(error)}`
        link = ''
      }
    }
    let person
    try {
      person = addPerson(root, { label_zh: label, name, sex, birth_year: birthYear, ...(memberId ? { mirobody_user_id: memberId } : {}), ...(linkError ? { link_error: linkError } : {}) })
    } catch (error) {
      return { ok: false, status: 500, error: error instanceof Error ? error.message : String(error) }
    }
    const dir = personDir(root, person.id)
    const age = birthYear ? new Date().getFullYear() - birthYear : null
    const normalized = normalizeProfile(mergeProfile(EMPTY_PROFILE, { displayName: name, sex, ...(birthYear ? { birthYear } : {}), ...(age ? { age } : {}) }))
    if (normalized.ok) writeProfile(dir, normalized.profile)
    if (memberId && link) saveMemberLink(root, person, link)
    else if (!memberId) saveConnection(dir, { mcp_url: link, mcp_token: '' })
    return { ...peopleView(deps), person: { id: person.id, label_zh: person.label_zh } }
  })

  deps.http.route('POST', '/api/longpi/people/active', async (_req, body) => {
    const v = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const id = text(v.id, 60)
    const root = resolveRootDir(deps.config().dataDir)
    // The demo is rebuilt from its bundled assets on every open: a clean, dated-to-today copy.
    if (isDemo(id)) {
      try { ensureDemoPerson(root); await openDemo(root) } catch (error) { return { ok: false, status: 500, error: `示例档案打开失败：${error instanceof Error ? error.message : String(error)}` } }
    }
    let switched = false
    try { switched = setActive(root, id) } catch (error) { return { ok: false, status: 500, error: error instanceof Error ? error.message : String(error) } }
    if (!switched) return { ok: false, status: 404, error: '未找到该成员。' }
    forgetPersonCaches()
    let warning = ''
    const person = activePerson(root).person
    if (person) warning = await ensureMemberLink(root, person)
    deps.invalidate()
    return { ...peopleView(deps), warning_zh: warning }
  })

  deps.http.route('POST', '/api/longpi/people/remove', async (_req, body) => {
    const v = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const id = text(v.id, 60)
    if (id === SELF) return { ok: false, status: 400, error: '不能移除你自己。' }
    if (isDemo(id)) return { ok: false, status: 400, error: '示例档案是内置的，不能移除。' }
    const root = resolveRootDir(deps.config().dataDir)
    if (!readRegistry(root).people.some((p) => p.id === id)) return { ok: false, status: 404, error: '未找到该成员。' }
    const dir = personDir(root, id)
    // This install's copy only (their deep-analysis folders too); Mirobody keeps their record.
    if (existsSync(dir)) deleteLocalStore(dir)
    try { removePerson(root, id) } catch (error) { return { ok: false, status: 500, error: error instanceof Error ? error.message : String(error) } }
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    deps.invalidate()
    return peopleView(deps)
  })
}
