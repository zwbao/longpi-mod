# NEEDS (life lane: 化验 / 睡眠 / 运动)

1. **Routes that depend on data.** `Page.routes(view)` sees only the view, and a draw cannot write state, so a
   page cannot ask for routes it learns from another route's answer. 睡眠 and 运动 need each wearable row's
   day-by-day values (`indicators/detail?id=device:…`). Worked around in `pages/life/series.tsx` `DEVICE_IDS`:
   a fixed list of the wearable ids LongPi knows per area goes into `routes()`. Ids the record does not have
   answer 404 (harmless, cached, read again on 刷新); a wearable id outside the list shows its weekly means
   with a 「读取每天的数值」 button. Wanted: `routes(view, json)` (the cache's `ctx.json`), or a way for a page
   to name follow-up routes once a route answered.
2. **`act.detail(id)` does not load the page's routes.** The page's `routes(view)` already names
   `indicators/detail?id=…` and `tracking` when a detail is open, but nothing reads them on `detail()`; the
   pages call `act.load([...])` beside `act.detail(id)` themselves. Wanted: `detail()` (and `setSub`) load
   `pageOf(tab).routes(newView)` the way `go()` does.
3. **Engine note (no change asked):** Esc on an open `Select` in the pane returns the keyboard to the prompt;
   the next keys go into the composer until `/longpi` (or ctrl+x tab) gives the pane the keyboard again.
