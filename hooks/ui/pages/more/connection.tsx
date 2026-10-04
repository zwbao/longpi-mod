// 数据连接 (client/connection.ts). Here the health record lives on this computer: the card says what it holds and
// how to add to it (give a report to Claude in the chat). The web page's manual form, for whoever installs LongPi
// against another record, stays folded: an address and an optional token, tested before anything is saved.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { Buttons } from '../../kit.tsx'
import { Dot, Err, Field, Note, Ok, SubFold } from './ui.tsx'
import type { Connection } from './types.ts'
import { errorOf, flag, setSub, sub, summaryParts, toggleFlag } from './util.ts'

export const REPORT_PROMPT = '请帮我录入这份体检报告：'

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** The same rule the server applies: https, or http only on this computer. */
function addressProblem(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return '请先粘贴连接地址。'
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return '这不是一个完整的网址，请复制以 https:// 开头的完整地址。'
  }
  if (url.protocol === 'https:') return null
  if (url.protocol === 'http:' && LOOPBACK.has(url.hostname)) return null
  return url.protocol === 'http:' ? '只有这台电脑上的地址可以用 http，其他地址请用 https。' : '地址要以 https:// 开头。'
}

export function isLocal(connection: Connection | null): boolean {
  return !connection || connection.url_masked.startsWith('local:') || connection.url_masked === ''
}

/** One line for the closed fold and the settings page. */
export function connectionLine(connection: Connection | null): string {
  if (!connection) return ''
  if (connection.status === 'ok') {
    const where = isLocal(connection) ? '存在这台电脑上' : '已连接'
    const found = connection.summary ? summaryParts(connection.summary).slice(0, 2).join(' · ') : ''
    return found ? `${where} · ${found}` : where
  }
  return connection.status === 'error' ? `连接失败：${connection.error || '未返回原因'}` : '尚未连接'
}

function status(ctx: Ctx, connection: Connection): RenderElement {
  const E = ctx.E
  const { Box } = E
  const ok = connection.status === 'ok'
  const bad = connection.status === 'error'
  const local = isLocal(connection)
  const head = ok
    ? local ? '健康记录存在这台电脑上' : `已连接 ${connection.url_masked}`
    : bad ? `连接失败：${connection.error || '未返回原因'}` : connection.pairing_error ? `尚未连接：${connection.pairing_error}` : '尚未连接'
  const found = ok && connection.summary ? `找到：${summaryParts(connection.summary).join(' · ')}` : ok && local ? '还没有体检数据。' : ''
  return (
    <Box key="conn-status" flexDirection="column">
      {Dot(E, ok ? 'on' : bad ? 'bad' : 'off', head, 'conn-dot')}
      {found ? Note(E, `  ${found}`, 'conn-found') : null}
    </Box>
  )
}

/** The manual form, folded: address, token, 测试连接 and 保存; 改回这台电脑上的记录 when another one is in use. */
function manual(ctx: Ctx, connection: Connection): Node[] {
  const E = ctx.E
  const url = sub(ctx, 'conn.url')
  const token = sub(ctx, 'conn.token')
  const busy = sub(ctx, 'conn.busy')
  const result = sub(ctx, 'conn.result')
  const failed = result.startsWith('!')

  const body = (): { mcp_url: string; mcp_token?: string } | null => {
    const problem = addressProblem(url)
    if (problem) {
      setSub(ctx, 'conn.result', `!${problem}`)
      return null
    }
    return { mcp_url: url.trim(), ...(token.trim() ? { mcp_token: token.trim() } : {}) }
  }
  const test = async () => {
    const request = body()
    if (!request) return
    setSub(ctx, 'conn.busy', 'test')
    setSub(ctx, 'conn.result', '')
    const out = await ctx.act.post('connection/test', request, { quiet: true })
    setSub(ctx, 'conn.busy', '')
    const n = typeof out.json.indicator_count === 'number' ? out.json.indicator_count : null
    setSub(ctx, 'conn.result', out.ok ? `连接成功${n !== null ? `，读取到 ${n} 项记录` : ''}。` : `!连接失败：${errorOf(out.json, '请稍后再试')}`)
  }
  const save = async () => {
    const request = body()
    if (!request) return
    const answer = await ctx.act.ask('保存后，LongPi 改读这个地址里的记录，这台电脑上的记录不再显示（以后可以改回）。要保存吗？', ['保存', '取消'], '数据连接')
    if (answer !== '保存') return
    setSub(ctx, 'conn.busy', 'save')
    setSub(ctx, 'conn.result', '')
    const out = await ctx.act.post('connection', request, { reload: ['connection', 'people', 'tracking'], quiet: true })
    setSub(ctx, 'conn.busy', '')
    if (!out.ok) {
      setSub(ctx, 'conn.result', `!连接失败：${errorOf(out.json, '请稍后再试')}`)
      return
    }
    setSub(ctx, 'conn.url', '')
    setSub(ctx, 'conn.token', '')
    const summary = out.json.summary as Connection['summary']
    setSub(ctx, 'conn.result', summary ? `连接成功，找到 ${summaryParts(summary).join(' · ')}` : '连接成功')
  }
  const clear = async () => {
    const answer = await ctx.act.ask('改回这台电脑上的健康记录？刚才连接的地址会被清除。', ['改回', '取消'], '数据连接')
    if (answer !== '改回') return
    const out = await ctx.act.post('connection', undefined, { method: 'DELETE', reload: ['connection', 'people', 'tracking'], done: '已改回这台电脑上的记录。', quiet: true })
    if (!out.ok) setSub(ctx, 'conn.result', `!清除失败：${errorOf(out.json, '请稍后再试')}`)
  }

  return [
    connection.source === 'saved' && !isLocal(connection) ? Note(E, `当前地址 ${connection.url_masked}`, 'conn-current') : null,
    Note(E, '仅在安装人员提供连接地址时填写，一般无需设置。', 'conn-why'),
    Field(ctx, { key: 'conn-url', label: '连接地址', value: url, placeholder: 'https://…', submitLabel: '记下', onInput: (value) => setSub(ctx, 'conn.url', value), onSubmit: (value) => setSub(ctx, 'conn.url', value) }),
    Field(ctx, { key: 'conn-token', label: '访问令牌', value: token, placeholder: '选填：地址中已包含时可留空', submitLabel: '记下', onInput: (value) => setSub(ctx, 'conn.token', value), onSubmit: (value) => setSub(ctx, 'conn.token', value) }),
    failed ? Err(E, result.slice(1), 'conn-result') : Ok(E, result, 'conn-result'),
    Buttons(E, [
      { key: 'conn-test', label: busy === 'test' ? '测试中…' : '测试连接', onPress: () => { if (!busy) void test() } },
      { key: 'conn-save', label: busy === 'save' ? '测试并保存中…' : '保存', primary: true, onPress: () => { if (!busy) void save() } },
      ...(!isLocal(connection) ? [{ key: 'conn-clear', label: '改回这台电脑上的记录', onPress: () => { void clear() } }] : []),
    ], 'conn-buttons'),
    Note(E, '保存前会先用此地址读取记录目录，读取成功后才保存；地址和令牌仅保存在这台电脑上。', 'conn-fine'),
  ]
}

export function ConnectionSection(ctx: Ctx, scope: string): Node[] {
  const E = ctx.E
  const cached = ctx.route('connection')
  const connection = ctx.json<Connection>('connection')
  if (!connection) {
    if (!cached || cached.loading) return [Note(E, '正在读取连接状态…', 'conn-loading')]
    return [Err(E, `连接状态没有读到：${cached.error || '请稍后再试'}`, 'conn-err'), Buttons(E, [{ key: 'conn-retry', label: '重试', onPress: () => ctx.act.load(['connection'], true) }], 'conn-retry-row')]
  }
  const open = flag(ctx, `${scope}.manual`)
  return [
    status(ctx, connection),
    Note(E, '添加记录：把体检报告的 PDF 或照片拖进对话框（或粘贴文件路径）交给 Claude，它会读出数值，存在这台电脑上。手环、血压计导出的表格也一样。', 'conn-how'),
    Buttons(E, [{ key: `${scope}-report`, label: '录入一份报告', onPress: () => ctx.act.fill(REPORT_PROMPT) }], `${scope}-report-row`),
    SubFold(E, `${scope}-manual`, '手动连接（安装人员使用）', open, () => toggleFlag(ctx, `${scope}.manual`)),
    ...(open ? manual(ctx, connection) : []),
  ]
}
