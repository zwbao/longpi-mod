// Copy the web research tab shared with the rest of the page (ux/plain.ts, client/science/consent.ts), kept
// word for word. Pure strings and text helpers; no elements.

export const SCIENCE_INTRO = 'LongPi 的用户共同研究如何延缓衰老。你可以用自己的数据做个人小试验，也可以加入大家的研究。'
export const OUTBOX_ZH = '研究正式开始后才会发出，现在只保存在你的设备上。'

/** One word for where things stay: 这台电脑 (server text sometimes says 你的设备). */
export function localText(text: string | null | undefined): string {
  return (text ?? '').replace(/你的设备/g, '这台电脑')
}

/** The page says once, at the top, that nothing leaves before a study starts; study texts drop their copy of that sentence. */
export function withoutStaysLocal(text: string | null | undefined): string {
  return localText(text).replace(/[^。]*研究正式开始[^。]*只保存在[^。]*。/g, '').trim()
}

// What the page never shows a person: backend names, codes, addresses (ux/plain.ts SCRUB).
const SCRUB: Array<[RegExp, string]> = [
  [/Mirobody/gi, '健康数据服务'],
  [/longevity-skills/gi, ''],
  [/\bMCP\b/g, ''],
  [/\/mcp\/\S*/g, ''],
  [/\bDSH\b/g, ''],
  [/HARNESS/gi, ''],
  [/\bLOINC\b/g, ''],
  [/\bRCV\b/g, '正常波动'],
  [/\bCVI\b/g, '个体波动'],
  [/ChiCTR/g, ''],
  [/签署密钥/g, ''],
  [/参考变化值/g, '平时的波动'],
  [/加了噪声/g, ''],
  [/\blive\b/g, ''],
  [/record_status/g, ''],
  [/~\/\.dsh\/longpi/g, '这台电脑'],
  [/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\S*/g, ''],
  [/\b(?:127\.0\.0\.1|localhost)\b/g, ''],
  [/(?:(?<=\s)|^):\d{2,5}\b/g, ''],
  [/\b[A-Z]\d{2}\.\d+\b/g, ''],
  [/\b(?:NaN|undefined|null)\b/g, ''],
  [/\b\d[\d,]*\s*tok(?:\/s)?\b/gi, ''],
  [/User says[:：][^\n]*/gi, ''],
  [/\bTHE PATTERN\b/g, '数据显示'],
  [/\bWHAT WE DON'T KNOW\b/g, '数据尚不能说明的'],
  [/[A-Za-z]+(?:[ \t]+[A-Za-z]+){2,}/g, ''],
]

export function scrubVisible(text: string): string {
  let out = text
  for (const [pattern, replacement] of SCRUB) out = out.replace(pattern, replacement)
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n').trim()
}

/** The registry's word for where a study stands (registry-page.ts). */
export const STATUS_ZH: Record<string, string> = {
  not_open: '未开放',
  collecting: '收集中',
  ready: '人数已到，尚未发布',
  released: '已发布',
}

/** The settings page's research switch (settings-page.ts ScienceSwitch). */
export const SWITCH_LABEL = '在这台电脑上参与研究'
export const SWITCH_TEXT = '开启后，可使用研究页、个人对照和本地统计，数据仅保存在这台电脑上。关闭后以上功能停止。未满 18 岁时始终关闭。'
