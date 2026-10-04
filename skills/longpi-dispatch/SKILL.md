---
name: longpi-dispatch
description: Dispatch longevity-skills for one person. Start from the onboarding stage, detect what they are asking, match on their question and their record, read the skill, then run it with measurements the tools returned; evidence questions go to query_longevity_evidence.
---

> 在 Claude Code 里，LongPi 的工具名是 `mcp__longpi__<名字>`；下面只写名字。LongPi 的页面用 `/longpi` 打开（总览、化验、睡眠、运动、日程、方案、长寿图鉴、档案、设置）。

# 调度

先 `read_personal_situation`。它给出档案、记录里的检查（名字、数值、单位）、自测记录、用药计划、以前算过的读出、记录现在就能跑的方法，以及 `onboarding`：走到哪一步、下一步、还没回答的档案问题、第一个结果或卡在哪里、下次体检该加测什么。

## 按阶段

- **档案没填完**（`questions_unanswered` 不为空，不论在哪个阶段）：一条短消息里只问还没回答的：年龄和性别，六个是否项（现在吸烟、糖尿病、两周内用过降压药、住南方还是北方、城市还是农村、父母或兄弟姐妹有心梗或脑卒中），一句话说明各自解锁什么。已经保存的不要再问。“不确定”“不知道”就是未知，不存成“否”（已存的答案传 null 清掉）。用 `save_personal_profile` 保存，对方说了最关心什么就一并存 `focus`。
- **consent**：同意只能本人在 LongPi 页面（/longpi 总览第一步）点「同意」，没同意时提一次即可，不要因此反复建档。`onboarding.pending` 为 true 时结果还在计算，不要猜。
- **records**：请对方把体检报告（PDF 或照片）的路径发给你，或直接拖进对话。你自己读（Read），再用 `record_measurements` 按报告原样录入：名称、数值、单位、报告日期，单子上有参考范围就一并录。录完用一句话列出录了什么。不要让对方填写地址、邮箱、密码或令牌。不要编造记录。
- **first_result 及以后**：不等对方问，先给出表型年龄（有多次体检就说趋势）和 China-PAR 风险，都说“模型估计”；工具给了正常波动才带上（`band_missing` 不为空时这个范围只是下限，China-PAR 没有波动范围，不要自己估）。算不出就说卡在哪里，列出 `addons`。然后问“想先改善哪一项？”，可以和对方一起起草方案，见 `longpi-interventions`。

## 记录里的明显变化

`record_changes` 列出两次体检之间超出个体正常波动（参考变化值）的指标。其中有 `ask_doctor` 为 true 的行时，先说这件事，放在其他结果之前：照 `text_zh` 说出指标、数值和日期，再转述 `advice_zh`，建议带着这几次体检报告咨询医生。不推测原因，不下诊断，也不建议任何补剂（包括铁剂）、药物或剂量。`verdict` 为 better 的行可以作为好消息提及；有 `caveat_zh` 时一并说明。

对方报出自己量的腰围、家庭血压或体重时，用 `save_self_measurement`，单位照对方说的传（斤、尺、寸、英寸会换算），不要替对方估一个值。

## 绑定

跑一个有输入清单的方法之前，用 `bind_longevity_inputs` 把记录行对到输入。不要自己换算单位，不要补档案里没有的行。插件核对单位、范围和来源。甲基化 PhenoAge 不能填血检表型年龄。单独写的 agatston（冠脉钙化积分）不能填腹主动脉钙化。可选输入没通过就丢掉并说明，不让整次失败。核对通过才 `run_longevity_skill`。结果带 verified、unverified-binding 或 evidence-only。只有 verified，而且变化超出正常波动，才可以说比实足年龄年轻。

## 三类问题

- **我的身体怎么样**（生物年龄、甲基化年龄、器官年龄、睡眠节律、端粒）：跑 A 类技能。`read_longevity_skill` 说 `structured_measurements` 时，用 `measurements` 传值，数值和单位照记录原样抄，不要自己换算。
- **某个东西有没有用**（NMN、二甲双胍、雷帕霉素、断食、某个基因）：用 `query_longevity_evidence`，按人群、动物、细胞分开说。
- **我的方案有没有用、怎么调整**：见 `longpi-interventions`。

技能目录里有全部方法（名字、一句话、分级、物种）。`match_longevity_skills` 和意图词只是提示，不是封闭名单：提示里没有的方法也可以读，也可以绑定后运行。问题笼统时可以看 `list_longevity_intents`。读完再绑定。

## 不做的事

技能没要的输入就停在缺项。不要用出生年估算值代替已经保存的实足年龄，除非这个人确认过。插件或脚本拒收一个值时，照原因说出来，不要改值重试。C 类是证据：说明第一句是物种。可以读，可以引用论文做了什么。不要把它跑成这个人的数字，也不要把它藏起来。跑完脚本后引用读出和标签，并保留其中的边界句。脚本没写出的数字不要补。
