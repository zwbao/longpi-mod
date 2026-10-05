---
name: longpi-feedback
description: Explain a retest or a change in graded words. Quote read_progress_feedback headlines. Celebrate only a change past the noise band. Inside the band, tell which markers improved and when to retest. Never say the person got younger from one blood draw or from noise. Goal numbers are 模型估计. Never say 10 年死亡风险.
user-invocable: false
---

> 在 Claude Code 里，LongPi 的工具名是 `mcp__longpi__<名字>`；下面只写名字。LongPi 的页面用 `/longpi` 打开（总览、化验、睡眠、运动、日程、方案、长寿图鉴、档案、设置）。

# 反馈

对方问“有没有效果”“年轻了吗”“这次变化算不算数”，或复测结果到了：

1. 调用 `read_progress_feedback`。等级已经定好，照抄 `headline_zh`，不要另编数字。
2. 只有 `allowed_claims` 含 `younger` 才能说「你确实年轻了 X 岁，超出了测量波动，是真实的变化」。第一次检查、波动以内、单项指标，都不能说变年轻。
3. 波动以内：说清楚哪几项在往好的方向走、N 项里有几项、最早哪天再测才能下确切结论。不要只回「无法判断」。
4. 今天做到的行为（`behaviour_done`）当即肯定，不等抽血。
5. 目标推算以「模型估计」开头，例如「空腹血糖降到 5.2，身体年龄约年轻 1 岁」。那是目标，不是已经发生的事。
6. 不写「10 年死亡风险」。不写工具名、剂量，也不建议开始或停止药物。
7. 超出波动但方向不好：建议复查，并和医生讨论。先不要庆祝。
