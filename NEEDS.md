# NEEDS — plan lane (方案, 日程)

## 1. Save a route's file to disk (导出到日历, also 导出报告 / 会员档案)

The web page offered `GET /api/longpi/calendar.ics` as a download (加入日历). A page can't reach it:
`route()` in `app/runtime.ts` drops the answer's `text`, the route cache keeps only JSON, and no action
writes a file.

Asked for: an action such as

```ts
/** GET a route that answers a file and write it to `path` (default ~/Downloads/<name>); toast where it went. */
saveRoute: (path: RoutePath, name: string) => Promise<{ ok: boolean; file: string }>
```

implemented in `register.tsx` with `rt.ctx.call('GET', '/api/longpi/calendar.ics')` (which still has
`.text`) and `$.fs.write`, then `$.ui.toast('已保存到 下载/longpi.ics，双击即可导入日历')`. The 日程 page would
call `ctx.act.saveRoute('calendar.ics', 'longpi.ics')` and show the path it was written to.

Until then the 导出到日历 button puts a request in the prompt (`ctx.act.fill`) for Pi to write the file.

## 2. (minor) Focus after a hot reload

After a save hot-reloads the plugin the pane keeps drawing but loses the keyboard; letters typed for the
pane's hotkeys go into the prompt until `/longpi …` is run again. Only matters while developing.
