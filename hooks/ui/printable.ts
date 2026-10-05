// A page to print: the brief's Markdown as a plain A4 HTML document (headings, lists, tables, bold), so a person
// without Markdown tools can open it in the browser and press 打印.

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(text: string): string {
  return esc(text).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function markdownToHtml(markdown: string, title: string): string {
  const out: string[] = []
  const lines = markdown.replace(/\r/g, '').split('\n')
  let list: 'ul' | 'ol' | null = null
  let table: string[][] | null = null
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null } }
  const closeTable = () => {
    if (!table) return
    const [head, ...body] = table.filter((row) => !row.every((cell) => /^:?-{2,}:?$/.test(cell.trim())))
    out.push('<table>')
    if (head) out.push(`<tr>${head.map((cell) => `<th>${inline(cell.trim())}</th>`).join('')}</tr>`)
    for (const row of body) out.push(`<tr>${row.map((cell) => `<td>${inline(cell.trim())}</td>`).join('')}</tr>`)
    out.push('</table>')
    table = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^\|.*\|$/.test(line.trim())) {
      closeList()
      table = table ?? []
      table.push(line.trim().slice(1, -1).split('|'))
      continue
    }
    closeTable()
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const quote = /^>\s?(.*)$/.exec(line)
    if (heading) { closeList(); const n = Math.min(4, (heading[1] ?? '#').length + 0); out.push(`<h${n}>${inline(heading[2] ?? '')}</h${n}>`) }
    else if (bullet) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul' } out.push(`<li>${inline(bullet[1] ?? '')}</li>`) }
    else if (numbered) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol' } out.push(`<li>${inline(numbered[1] ?? '')}</li>`) }
    else if (quote) { closeList(); out.push(`<p class="note">${inline(quote[1] ?? '')}</p>`) }
    else if (line.trim() === '') closeList()
    else { closeList(); out.push(`<p>${inline(line)}</p>`) }
  }
  closeList()
  closeTable()
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4;margin:16mm}body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:13px;line-height:1.55;color:#111;max-width:760px;margin:24px auto;padding:0 16px}
h1{font-size:20px;margin:0 0 8px}h2{font-size:16px;margin:16px 0 6px;border-bottom:1px solid #ccc}h3,h4{font-size:14px;margin:12px 0 4px}
table{border-collapse:collapse;width:100%;margin:6px 0}td,th{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#f2f2f2}
.hint{color:#666;font-size:12px}.note{color:#444;border-left:3px solid #bbb;padding-left:8px}@media print{.hint{display:none}}
</style></head><body><p class="hint">按 ⌘P（Windows 上 Ctrl+P）打印。</p>${out.join('\n')}</body></html>
`
}
