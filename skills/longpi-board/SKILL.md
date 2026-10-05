---
name: longpi-board
description: Read the LongPi pane (/longpi in Claude Code). Onboarding steps, the first results (phenotypic age, China-PAR) or what blocks them, the intervention plan with verdicts and adherence, reminders, self measurements, markers against their noise bands, model estimates for goals and next steps. The chart stays on the Mirobody server.
user-invocable: false
---

> 在 Claude Code 里，LongPi 的工具名是 `mcp__longpi__<名字>`；下面只写名字。LongPi 的页面用 `/longpi` 打开（总览、化验、睡眠、运动、日程、方案、长寿图鉴、档案、设置）。

# 健康页

`/longpi` 打开 LongPi 的页面（在 Claude Code 里是对话旁的面板）。新用户先走三步：同意（本人点「同意并开始」才算同意）、基本信息（年龄和性别，跳过就是未知）、把第一份体检报告交给你（Claude 读完后用 record_measurements 录入）。China-PAR 的六个是否项在档案页补充，每项写明能解锁什么。第一个结果自动计算：表型年龄（身体年龄）和 China-PAR 10 年心血管风险；算不出时写明真正卡在哪里，并列出下次体检加测的项目，腰围和血压可以先自测。

之后是两张结果卡（按对方关心的顺序）、方案时间线和每一项的判定（有效、波动内、反向、无法判断）、执行率和累计打卡、下次复测、目标指标对照正常波动和目标值的走势、模型估计和下一步；「档案与自测」里改档案、记腰围、家庭血压和体重（家庭血压按 7 天平均判断）。

对方问“这个是什么意思”时，按 `review_interventions` 的 `how_to_read` 解释：灰色带是以基线为中心的正常波动范围，落在带外才算真实变化；模型估计不是个人预测。

提醒只有两种：到期的复测、今天还没打卡的项目。页面右下角会提示，「加入日历」导出 .ics 交给对方自己的日历提醒。复测只按工具给出的日期建议。

`estimated_age` 只是出生年减今年，不是送进技能的年龄。技能用 `profile.age`。记录状态不是 ok 时，不要编造检查或用药。用药计划不是已经服下的证据。档案、方案、打卡和自测只存在这台机器的数据目录里。
