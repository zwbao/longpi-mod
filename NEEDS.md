# NEEDS (overview lane)

- **Person switch leaves other pages' caches stale.** `people/active` reloads only the routes it names
  (总览 names journey, tracking, people, surfaces, triage, codex/slot, indicators, science/invite, followup,
  privacy). Routes other pages loaded before the switch (`indicators?area=labs`, `board`, `codex`, `plan-draft`,
  `analysis` …) stay "fresh" for up to 90 s and show the previous person. Wanted: an action (or a rule in
  `post` for `people/active`) that drops the whole route cache after a switch.
- **Profile POSTs ~1 s apart lose earlier answers.** Pressing 男, then 不确定 (吸烟), 否 (糖尿病) and a focus
  chip in quick succession left only the last two in `profile.json`. Each request is merged server-side
  (`mergeProfile(readProfile(), update)`), so something between ops (vfs sync/flush, or a journey build) writes
  an older profile back. Worked around on 总览: answers are kept in the view state at once and every save sends
  the whole answer set. The core race is still there for other callers (the 档案 page, the chat's tool).
- **Copy in core still says DeepSeek / 健康页 / 上传.** The privacy route's PIPL text ("发给你配置的 DeepSeek"),
  journey blockers ("在健康页填写") and next steps ("上传一份体检报告") come from the core. 总览 rewrites them
  for the pane (`inClaude`, `inPane` in `pages/overview/words.ts`); the chat and other pages still show the
  originals. The consent scope is still named `data_flow_deepseek` (posted, never shown).
- The pane banner ("下一步：… g: 开始") still shows while the onboarding steps are already on screen.
- **Promote `wrapZh` / `Para` to kit.** `pages/overview/ui.tsx` has a line breaker for Chinese paragraphs set to a
  known width: breaks between characters, keeps numbers and Latin words whole, and never starts a line with
  。，、」… (Ink's own wrap leaves a lone 「。」 on the last line when a sentence fills the width exactly). Other
  pages will want it; kit's `zh` alone does not prevent the dangling mark.
