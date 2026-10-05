// The text of a PDF report, page by page, with macOS PDFKit (no other tools needed). A scan has no text layer
// and comes back empty. Usage: osascript -l JavaScript pdf_text.js <pdf> [maxPages]
ObjC.import('PDFKit')
ObjC.import('Foundation')

function run(argv) {
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(argv[0]))
  if (!doc || doc.isNil()) return JSON.stringify({ error: 'cannot open' })
  const pages = Number(doc.pageCount)
  const max = Math.min(pages, Number(argv[1] || 80))
  const text = []
  for (let i = 0; i < max; i++) text.push(String(ObjC.unwrap(doc.pageAtIndex(i).string) || ''))
  return JSON.stringify({ pages, read: max, text })
}
