import { Buffer } from '../../sys/buffer.ts'
// One archive of the local LongPi store, without secrets, plus a pointer to the person's Mirobody.

import { lstatSync, readdirSync, readFileSync, statSync } from '../../sys/fs.ts'
import { homedir } from '../../sys/os.ts'
import { join, relative, sep } from '../../sys/path.ts'
import { readConnection } from '../connection.ts'
import { disclosureCopy } from './disclosure.ts'

const MAX_FILE = 25_000_000
const MAX_TOTAL = 80_000_000

export interface MirobodyLink {
  url: string
  note_zh: string
}

/** The Mirobody the person connected. LongPi does not download their record; this is where they export it. */
export function mirobodyExportLink(dataDir: string, fallbackUrl = ''): MirobodyLink {
  const saved = readConnection(dataDir)
  const raw = (saved?.mcp_url || fallbackUrl || '').trim()
  let url = ''
  if (raw) {
    try {
      const parsed = new URL(raw)
      url = `${parsed.protocol}//${parsed.host}/`
    } catch {
      url = raw
    }
  }
  const note_zh = url
    ? '体检原件保存在健康数据服务中，不在此压缩包内。'
    : '健康数据服务尚未连接。体检记录不在此压缩包内。'
  return { url, note_zh }
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipStore(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const crc = crc32(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(file.data.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    parts.push(local, name, file.data)
    const cen = Buffer.alloc(46)
    cen.writeUInt32LE(0x02014b50, 0)
    cen.writeUInt16LE(20, 4)
    cen.writeUInt16LE(20, 6)
    cen.writeUInt16LE(0x0800, 8)
    cen.writeUInt32LE(crc, 16)
    cen.writeUInt32LE(file.data.length, 20)
    cen.writeUInt32LE(file.data.length, 24)
    cen.writeUInt16LE(name.length, 28)
    cen.writeUInt32LE(offset, 42)
    central.push(cen, name)
    offset += local.length + name.length + file.data.length
  }
  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, centralBuf, end])
}

// What the archive carries: the person's own records, by name. Anything else in the LongPi home (the link and
// account for the health data service, reminder channels, logs, page state, the workspace folder, family members'
// stores) is left out, so a file added later stays out until it is listed here.
const KEEP_FILES = new Set([
  'profile.json', 'plan_prefs.json', 'self_measurements.jsonl', 'medication_statements.jsonl', 'memory.json', 'memory_log.jsonl',
  'feedback.jsonl', 'history.jsonl', 'privacy/consents.jsonl',
  // methylation, microbiome, protein and diagnosis tables saved on this computer only (stores/disk.ts)
  'methylation.json', 'taxa.json', 'proteins.json', 'conditions.json',
])
// interventions/: the plan versions and check-ins; schedule/: confirmed visits and retests.
const KEEP_DIRS = ['interventions/', 'schedule/', 'briefs/', 'datain/', 'analysis/', 'science/', 'engage/']
/** An import in progress leaves these next to analysis/current for a moment. */
const TRANSIENT = /(?:^|\/)current\.(?:next|old)-/

/** Whether a path (relative, with /) is outside what the archive carries. Directories on the way are walked. */
function skip(name: string, isDir = false): boolean {
  if (!name || name.includes('..')) return true
  if (name.endsWith('.tmp') || name.includes('.tmp-') || name.includes('.damaged-') || TRANSIENT.test(name)) return true
  if (isDir) return !(KEEP_DIRS.some((dir) => `${name}/`.startsWith(dir)) || name === 'privacy')
  return !(KEEP_FILES.has(name) || KEEP_DIRS.some((dir) => name.startsWith(dir)))
}

function walk(root: string, dir: string, out: string[]): void {
  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(dir, entry)
    const rel = relative(root, path).split(sep).join('/')
    let st
    try {
      st = lstatSync(path)
    } catch {
      continue
    }
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) {
      if (!skip(rel, true)) walk(root, path, out)
    } else if (st.isFile() && !skip(rel)) out.push(rel)
  }
}

// Any personal MCP path (a family member's link, one minted for a deep analysis) and any JWT, even those not saved
// as this person's connection; the home folder in an absolute path becomes ~.
const MCP_PATH = /(\/mcp\/)[A-Za-z0-9_-]{16,}/g
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g

function scrub(data: Buffer, secrets: string[]): Buffer {
  let text: string | null = null
  try {
    text = data.toString('utf8')
  } catch {
    return data
  }
  // Only text that is UTF-8 as it stands is edited; anything else (a binary without NUL) is kept byte for byte.
  if (text.includes('\u0000') || !Buffer.from(text, 'utf8').equals(data)) return data
  let next = text
  for (const secret of secrets) {
    if (secret.length >= 6) next = next.split(secret).join('[redacted]')
  }
  // JWTs first: one inside an MCP path would otherwise leave its payload and signature behind.
  next = next.replace(JWT, '[redacted]').replace(MCP_PATH, '$1[redacted]')
  const home = homedir()
  if (home.length > 1) {
    // The home folder only as a whole path segment: /Users/li is not the start of /Users/lisa.
    for (const form of new Set([home, JSON.stringify(home).slice(1, -1)])) {
      next = next.replace(new RegExp(`${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[/\\\\"'\\s]|$)`, 'g'), '~')
    }
  }
  return next === text ? data : Buffer.from(next, 'utf8')
}

/** The link, token, account email and password for the health data service, wherever they might be echoed. */
function secretsOf(dataDir: string, fallbackMcpUrl: string): string[] {
  const saved = readConnection(dataDir)
  const out = [saved?.mcp_token ?? '', saved?.mcp_url ?? '', fallbackMcpUrl]
  try {
    const account = JSON.parse(readFileSync(join(dataDir, 'mirobody-account.json'), 'utf8')) as Record<string, unknown>
    for (const key of ['password', 'email', 'token', 'jwt']) if (typeof account[key] === 'string') out.push(account[key] as string)
  } catch {
    // no account on this computer
  }
  // The personal path of an MCP link is the secret part even without the host.
  for (const url of [saved?.mcp_url ?? '', fallbackMcpUrl]) {
    const path = /\/mcp\/([^/?#\s]+)/.exec(url)?.[1]
    if (path) out.push(path)
  }
  return out.filter((value) => value.length >= 6)
}

/** Zip of the person's own records. No link, token or account for the health data service; no family stores. */
export function buildExport(dataDir: string, fallbackMcpUrl = ''): { zip: Buffer; filename: string; link: MirobodyLink; files: string[] } {
  const link = mirobodyExportLink(dataDir, fallbackMcpUrl)
  const secrets = secretsOf(dataDir, fallbackMcpUrl)
  const names: string[] = []
  walk(dataDir, dataDir, names)
  const files: Array<{ name: string; data: Buffer }> = []
  let total = 0
  const included: string[] = []
  const tooLarge: string[] = []
  for (const name of names) {
    const path = join(dataDir, ...name.split('/'))
    let data: Buffer
    try {
      if (statSync(path).size > MAX_FILE) {
        tooLarge.push(name)
        continue
      }
      data = readFileSync(path)
    } catch {
      continue
    }
    data = scrub(data, secrets)
    if (total + data.length > MAX_TOTAL) {
      tooLarge.push(name)
      continue
    }
    files.push({ name, data })
    included.push(name)
    total += data.length
  }
  const copy = disclosureCopy()
  const note = [
    'LongPi 本地档案',
    '',
    '此压缩包是你在这台电脑上的 LongPi 档案：基本情况、方案与打卡、自测、用药与病情、记下的事项、医生简报和深度分析结果。',
    '不含连接健康数据服务的账号、密码和链接，不含提醒渠道设置，也不含家人的档案。',
    link.note_zh,
    '',
    copy.data_flow.name,
    copy.data_flow.session_log,
    '',
    `文件 ${included.length} 个。`,
    ...(tooLarge.length > 0 ? ['', `以下文件过大，未放入压缩包，仍保存在这台电脑上：${tooLarge.join('、')}。`] : []),
  ].join('\n')
  files.push({ name: '说明.txt', data: Buffer.from(note, 'utf8') })
  const now = new Date()
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { zip: zipStore(files), filename: `longpi-${day}.zip`, link, files: [...included, '说明.txt'] }
}
