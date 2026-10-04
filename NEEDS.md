# NEEDS (lane: more — 档案 and 设置)

Things the 档案 / 设置 pages need from shared code (register.tsx, types.ts, core). The pages work around each one
today; the workaround is named.

## 1. A file writer for exports — `ctx.act.saveFile(route, fileName)`

`route()` in `app/runtime.ts` returns `{ status, json }` and drops the body text, so a page cannot get the raw
answers of `report` (markdown), `member-file` (markdown, `__raw`), `calendar.ics` (text) or `privacy/export`
(a zip, binary, via `rawRoute`). Asked for:

```ts
saveFile: (route: RoutePath, fileName: string) => Promise<{ ok: boolean; path?: string; error?: string }>
```

GET the route in process, write the body (bytes for the zip) to `~/Downloads/<fileName>` (or
`$LONGPI_HOME/exports/`), toast the path, answer it. The pages already feature-detect it
(`more/exports.tsx` `saver(ctx)`): once it exists, 导出报告 / 会员档案 / 加入日历 / 下载完整档案 (档案 → 导出) and
导出报告 / 下载这台电脑上的 LongPi 档案 (设置 → 隐私与数据) appear and work with no page change. Until then the pages
say plainly that a file cannot be saved from here yet and offer 让 Claude 整理报告 (`ctx.act.fill`).

## 2. Importing a member file

There is no route for it (neither in the web plugin): import is the core tool `import_member_file`. The page takes
the path in an `Input`, checks it (absolute or `~/`, `.md`) and puts `请帮我导入这份会员档案：<path>` in the prompt
(`ctx.act.fill`), so Claude runs the tool. A `POST member-file { path }` route, or an action that runs a core tool
without a model turn (`ctx.act.tool(name, args)`), would make it one press.

## 3. Adding a family member with the local record

`POST people` creates the member in a Mirobody account first (`holderAuth` → `createManagedMember`) and answers 409
(「…请先在「档案」的「数据连接」中点「重新连接」」) when there is none, which is always the case with the local
record. `people.can_create_in_mirobody` is false, so the page shows a plain note instead of the form. Core needs a
local path: a new person folder with `connection = local:` and the profile (label, name, sex, birth year).
The form (称呼 / 出生年份 / 姓名 / 生理性别, then switch to the new person) is written and shows as soon as
`can_create_in_mirobody` is true.

## 4. Switching person should drop the whole cache

`people/active` changes whose record every route reads, but `post(..., { reload })` re-reads only what the page
names (plus journey); other pages' cached answers stay for up to 90 s. The page names every route it and the header
read (`PERSON_ROUTES` in `more/people.tsx`) and calls `ctx.act.refresh()` after a switch. An option to clear the
whole cache (`post(..., { reloadAll: true })`, or an `act.reset()`) would be right.

## 5. `GET match?q=…` answers 500 「match failed」 in the mod (core)

`loadEvidenceLexicon` (`core/intents.ts:109`) reads
`<skills>/skills/longevity-evidence/data/claims.jsonl` synchronously and the vfs has not loaded it
(`EIO … (not loaded)`). The 找方法 field in 设置 → 高级 shows the route's error until that file is preloaded (or read
through the async door first).

## 6. Copy in the core that names the web host (for the owner)

- `privacy` copy (`core/privacy/disclosure.ts`): `to_deepseek`, `flow_grant`, the PIPL paragraphs name DeepSeek;
  `stays_local` has 「编程或其他工作区不会加载 LongPi 的角色设定…」 (a DSH workspace notion); `mirobody` says
  「体检和手环的原件保存在健康数据服务中」. The pages show DeepSeek as Claude (`hostText` in `more/util.ts`), leave the
  workspace line and the 健康数据服务 lines out, and add that the record's values are kept on this computer. The core
  copy (and its consent text version) should change at the source.
- `core/privacy/register.ts` `gateText` tells the model to 「打开 /api/longpi/privacy?view=page 完成单独同意」. In
  the mod the consent lives at /longpi 档案 → 隐私与数据 (or /longpi 设置 → 隐私与数据).
- `followup` notes say 「提醒只在 DeepSeek Harness 运行时发送」; the page says 「提醒只在 Claude Code 开着时发送」.
- `export.mirobody_note_zh` 「体检原件保存在健康数据服务中，不在此压缩包内」 does not hold for the local record; the
  page says what the archive holds instead.
- `people.create_hint_zh` and the 409 of `POST people` point to 「数据连接」「重新连接」, which the mod no longer has.

## 7. Model use is counted in calls only

`usage.today.input/output` stay 0 while `calls` grows: `io.complete` reports no token counts, so the 读入/写出额度
bars in 设置 → 模型与用量 always read 还剩 100%. If `$.model.complete` returns usage, the runtime could pass it to the
budget ledger.

## 8. Engine note: the focus ring and trees that change before it

When a press changes the tree before the focused element (e.g. an accordion that closes the section above while
opening this one), the terminal drops the focus ring and the next Tab starts again from the top of the pane. The
pages therefore open and close each section on its own (never one-open-at-a-time). Worth knowing for other lanes.

## 9. Wrapping Chinese: `zh()` splits Latin words

`zh()` turns every ASCII space in CJK text into a no-break space, so Ink can no longer break at a space and cuts
wherever the line ends: 「…可以让 Clau / de 把报告整理出来」, a line starting with 「、」. This lane wraps its own
paragraphs instead: `wrapCells(text, width)` and `Para(ctx, text, …)` in `more/ui.tsx` break between CJK characters,
never inside a Latin word or number, and never start a line with closing punctuation; each line is its own `Text`, so
Ink does not wrap again. Offered for `kit.tsx` (Lines / Muted could use it given a width).
