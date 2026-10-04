# NEEDS (research lane: 研究, 深度分析)

1. **Raw route bodies in the cache.** `runtime.route()` drops the `text` that `cordis.call()` returns, so a route that answers
   with `{ __raw }` reaches a page as `{ status: 200, json: null }`: `analysis/report` (the report HTML),
   `science/community?view=page`, `science/transparency?download=1`, `brief?format=md`. Please keep `text` (and the
   content type) on `RouteCache` when `json` is null. The 深度分析 full-report view already reads
   `ctx.route('analysis/report').text` when it is there and shows the report's 摘要 as markdown (`summaryOfHtml` in
   `pages/research/analysis-report.tsx`); until then it shows every readout from `analysis` and offers
   「请 Claude 讲解报告」. A core `analysis/report?format=md` would do as well.
2. **A GET for the personal trial.** `POST science/n-of-1` writes `science/n-of-1.json` but nothing reads it back, so the
   pane keeps the answer in `view.sub['research.nof1']` (lost when Claude Code restarts). A `GET science/n-of-1`
   answering the stored plan (no seed) would let the 研究 page always show 我的个人对照.
3. **A page-level poll.** While a deep analysis runs, the web read `analysis` every 15 s. The pane's tick is 60 s; the
   page asks `ctx.act.load(['analysis'], true)` from `draw` when a run is active and the cache is older than 15 s,
   so stages move about once a minute. A `Page.poll?: (view) => number | null` the engine honours would be cleaner.
4. **The vote in local mode.** `GET science/community` answers `mine: null, votes: 0` in local mode even after a vote
   was saved (votes are read only in simulated mode); the page remembers the vote it sent in `view.sub`.
