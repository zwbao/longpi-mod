---
name: uls8-loneliness-scale
description: >-
  Scores the ULS-8 short-form UCLA Loneliness Scale (Hays and DiMatteo 1987) for one person: eight answers
  coded 1 to 4, items 3 and 6 reverse-scored, total 8 to 32, higher means lonelier. Gives the score without a
  category, because no published cut-point was found. Use when the user mentions loneliness, feeling isolated,
  孤独, 寂寞, 没人说话, or the UCLA loneliness scale. Item wording is copyrighted and is not reproduced.
---

# ULS-8 孤独感量表

用户交 8 道题的答案（每题 1–4），可选年龄。不要向用户要论文 PDF 或别的量表文件。

## 怎么问、怎么填

题目原文受版权保护，技能里没有收录。请用户用正式问卷（原版或已发表的中文版）作答；只能口头问时，按下面的主题用自己的话问，并说明这是近似问法。每题四个答案：从不 1、很少 2、有时 3、经常（或总是）4。

| 题号 | 主题 | 计分 |
| --- | --- | --- |
| 1 | 缺少陪伴 | 照原样 |
| 2 | 有没有可以求助的人 | 照原样 |
| 3 | 自己是不是外向的人 | 反向 |
| 4 | 觉得被冷落、被排除在外 | 照原样 |
| 5 | 觉得和别人隔绝 | 照原样 |
| 6 | 想要陪伴时能不能找到 | 反向 |
| 7 | 因为自己退缩、孤僻而不开心 | 照原样 |
| 8 | 身边有人，却觉得他们并不和自己在一起 | 照原样 |

第 3、6 题也照答卷原样填，脚本自己反向计分（5 减原答）。不要先自己反过来。

## Command

```bash
python "$SKILL/scripts/personal_report.py" --measurements answers.csv --age 68 --out out
```

`answers.csv` 用表头 `item,value,unit`，名称写 `uls8_item1` 到 `uls8_item8`（也认「第1题」「q1」这类写法），数值写 1–4 或「从不、很少、有时、经常、总是」，单位列留空或写 `score`。8 题缺一题、超出 1–4、不是整数或单位不对时不计算：报告写明原因，退出码 3。`out/result.json` 给出 `uls8_score`。

## 报告里要保留的

- 只给分数和范围，不贴「轻、中、重」的标签，也不自己编切点。
- 心理危机热线那一段（12356、希望24热线 400-161-9995、120 或 110）原样保留。对话里如果用户说到绝望或伤害自己的念头，先按助手的紧急流程处理，再谈分数。
- 不下诊断，不谈药物。
- 引用 `out/report.md`，包括 `边界:` 那一行。
