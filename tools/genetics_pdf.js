// A narrative genetic-test PDF (a WeGene report runs to ~2900 pages), read on this computer with macOS PDFKit:
// the cover, and four pages from each outline entry whose title names one of the key traits. The rest of the
// report is never opened. Usage: osascript -l JavaScript genetics_pdf.js <pdf> '<json keywords>'
ObjC.import('PDFKit')
ObjC.import('Foundation')

function run(argv) {
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]))
  if (!doc || doc.isNil()) return JSON.stringify({ error: 'cannot open' })
  const want = JSON.parse(argv[1] || '[]')
  const pages = Number(doc.pageCount)
  const outline = []
  const walk = (node, depth) => {
    if (!node || node.isNil() || depth > 3) return
    const count = Number(node.numberOfChildren)
    for (let i = 0; i < count; i++) {
      const child = node.childAtIndex(i)
      const dest = child.destination
      const page = dest && !dest.isNil() ? Number(doc.indexForPage(dest.page)) + 1 : 0
      outline.push({ title: String(ObjC.unwrap(child.label) || ''), page })
      walk(child, depth + 1)
    }
  }
  walk(doc.outlineRoot, 1)
  const picked = []
  const titles = new Set()
  for (const word of want) {
    const hit = outline.find((row) => row.page > 0 && row.title.includes(word) && !titles.has(row.title))
    if (hit) { picked.push(hit); titles.add(hit.title) }
    if (picked.length >= 18) break
  }
  const textOf = (n) => String(ObjC.unwrap(doc.pageAtIndex(n - 1).string) || '')
  const seen = new Set()
  const sections = []
  for (const row of picked) {
    for (let n = row.page; n < row.page + 4; n++) {
      if (n < 1 || n > pages || seen.has(n)) continue
      seen.add(n)
      sections.push({ title: row.title, text: textOf(n).slice(0, 3500) })
    }
  }
  return JSON.stringify({ cover: pages > 0 ? textOf(1).slice(0, 1500) : '', sections, pages_read: seen.size, pages, outline: outline.length })
}
