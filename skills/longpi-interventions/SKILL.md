---
name: longpi-interventions
description: Draft an intervention plan with the person from their results and the collected trial evidence (lifestyle items with concrete behavioral targets, supplements only as options to confirm with a doctor, never a dose or a prescription change), or save their own plan, after they confirm a read-back; record check-ins and self measurements, judge each item against their record (noise band, retest timing, adherence, confounders), remind retests on the dates the tools give, set up follow-up reminders they agree to, and show model estimates for their goals.
---

> 在 Claude Code 里，LongPi 的工具名是 `mcp__longpi__<名字>`；下面只写名字。LongPi 的页面用 `/longpi` 打开（总览、化验、睡眠、运动、日程、方案、长寿图鉴、档案、设置）。

# 干预方案

方案可以是对方自己的（或医生、长寿师给的），也可以由 LongPi 按对方的检查结果和研究证据起草、再和对方一起调整。不论哪种，都要读给对方确认后才保存。

## 起草方案

对方问“帮我制定一份改善方案”，或给出第一个结果后想改善某一项时：

1. 调 `draft_intervention_plan`，每次请求只调一次（对方这次说了想改善什么，就传 `focus` 或 `markers`；说了限制，比如不要限时进食、膝盖不好、上夜班、怀孕、备孕、哺乳，传 `constraints`——排除的项目会保存下来，以后每次起草都不会再出现）。备孕和哺乳与怀孕一样：不安排限时进食或断食，体重指数低于 24 时不设减重目标，酒写避免而不是减少；备孕另有一句中国常规人群指导，叶酸每天 0.4 mg，不是新开的个人剂量。返回后按 `reply_zh` 回复，这一轮不再调用别的工具。
2. `brief.safety.stop_zh` 有内容时（危急值，或血红蛋白、平均红细胞体积偏低或逐次下降、铁蛋白偏低、医生还不知道的糖尿病范围血糖、LDL-C ≥4.9、收缩压 ≥180），这句话就是整条回复：请对方带着报告去看医生，这次没有草稿。低于参考范围就说「偏低」，不要说「不能评」。`brief.notes_zh` 提到记录里有超出正常波动的变化时，先说这件事，建议先请医生看过再开始方案；不推测原因，也不为它建议补剂或剂量。
3. `brief.priorities` 说明为什么先改这些指标（模型估计或对方最关心的）；`draft.items` 是按证据选的 2–3 项生活方式；`goals` 是“最新值 + 试验平均效应”，只是估算。
4. 和对方一起调整：去掉做不到的，换成 `brief.candidates` 里的其他选项，按对方的习惯改写做法。行为目标（步数、分钟、小时、份数）只用证据、对方数据或技能给出的数字。每一项都说出证据：试验平均效应、人群、DOI，并说明个人效果因人而异。
5. 补剂只作为“需先与医生确认”的选项，说证据，不给剂量。`needs_doctor` 和 `cautions_zh` 要照实转述。
6. 不开始、不停止、不调整任何处方药，也不给药物或补剂剂量。
7. 调整好后按下面“保存”的步骤读回确认。LongPi 页面「方案」里和对话里方案卡片上的「采用这份方案」也会按同样的检查保存。

## 保存

1. 整理成条目：类别、名称、开始日期（YYYY-MM-DD，没有就问）、针对的指标、目标值（对方方案里写明的，或草稿按证据估算的）。手环能记录的项目（步数、睡眠）给 `target`，指标名用 `read_personal_situation` 里记录的名字（手环数据如 dailySteps、sleepDuration）。
2. 先调 `save_intervention_plan`，`confirm` 为 false，把 `read_back` 和 `warnings` 原样读给对方听。
3. 对方确认后，再用同样的内容调一次，`confirm` 为 true。以后调整一次只改一项，存成新版本。

药物和补剂只按名字保存，剂量和服用记录不进方案。方案文档里的剂量不保存，也不要复述成建议。

## 随访提醒

方案保存后，问一次要不要提醒：每天晚上提醒打卡、复测日提醒、每周小结。说明发什么、什么时候、走哪个渠道（桌面通知，或飞书、企业微信、钉钉、Bark 等 webhook），以及默认“简要”模式不会把健康数值和项目名称发出去。对方同意后才用 `set_followup` 打开。对方想要 AI 自己写的随访，就用 `schedule_create` 建一个定时任务，指令是：“LongPi 随访：先调用 review_interventions，再写一段不超过 120 字的中文随访（肯定做到的、指出一项最值得坚持的下一步，不提剂量），然后调用 send_followup_message 发送；如果它因为“简要”设置拒绝，就去掉数值、指标名和项目名，改成笼统的鼓励和“打开健康页查看”再发一次。”免打扰时段里不会发送。提醒只在 DeepSeek Harness 运行时发送。

## 每天

手环记录的项目自动计数。其他项目对方说一句（“今天快走了 40 分钟”）或在 LongPi 页面「方案」里点打卡，用 `log_intervention_checkin` 记下；生病、出差、换了检测机构、压力大给对应的 tag。自己量的腰围、家庭血压、体重用 `save_self_measurement`；家庭血压按最近 7 天的平均判断，多量几天比量一次可靠。

## 复测与判断

复测只按 `review_interventions` 给出的日期建议（LongPi 页面的提醒和日程用的是同一批日期）。用 `review_interventions` 判断，按它的 `how_to_read` 解读：

- **有效**：变化超出这个人自身的正常波动，方向是好的，复测时间够，方案也执行了。可以为对方高兴。
- **波动内**：还在正常波动范围内，既不算进步也不算失败，解释清楚并鼓励坚持。
- **反向**：超出波动但方向不好。建议复查确认，并和医生讨论。
- **无法判断**：没有基线、复测太早、执行率太低、CRP 超过 10 mg/L，或缺少变异数据。要说清是哪一种。

同期还有别的干预或用药变化时，只能评价组合。`expected` 是人群平均，不是对这个人的预测。调整方案时一次只改一项，按上面的步骤起草、读回、确认。

## 模型估计

`model_intervention_goals` 和 `review_interventions` 里的 `models` 是模型估计：表型年龄和 10 年死亡风险来自表型年龄技能，心血管风险来自 China-PAR。引用时说“模型估计”，照抄 `boundary_zh`。不要说“你会多活 X 年”。
