---
name: rmeq-chronotype
description: >-
  Scores the reduced Morningness-Eveningness Questionnaire (rMEQ; Adan and Almirall 1991) for one person: five
  items taken from MEQ items 1, 7, 10, 18 and 19, total 4 to 25, and the published five chronotype categories
  (definitely evening 4-7, moderately evening 8-11, neither 12-17, moderately morning 18-21, definitely morning
  22-25). Use for 晨型, 夜型, 夜猫子, chronotype or morningness. Does not estimate melatonin onset or prescribe
  sleep schedules. Item wording is copyrighted and is not reproduced.
---

# rMEQ 晨型夜型问卷

用户交 5 道题的选项分，可选年龄。不要向用户要论文 PDF 或完整的 19 题问卷。

## 怎么问、怎么填

题目原文受版权保护（MEQ © 1976 Gordon and Breach），技能里没有收录。请用户用正式问卷（原版或已发表的中文版）作答，再把每题选项对应的分数交来。

| 题号 | 原 MEQ 题号 | 主题 | 可填的分 |
| --- | --- | --- | --- |
| 1 | 1 | 完全自由安排时，几点起床 | 1–5，越早越高 |
| 2 | 7 | 早上醒来后半小时内有多累 | 1–4，越清醒越高 |
| 3 | 10 | 晚上几点开始觉得累、想睡 | 1–5，越早越高 |
| 4 | 18 | 一天里几点状态最好 | 1–5，越早越高 |
| 5 | 19 | 觉得自己是晨型还是夜型 | 只能是 6、4、2、0，越偏晨型越高 |

## Command

```bash
python "$SKILL/scripts/personal_report.py" --measurements rmeq.csv --age 45 --out out
```

`rmeq.csv` 用表头 `item,value,unit`，名称写 `rmeq_item1` 到 `rmeq_item5`（也认「第1题」「q1」和原 MEQ 题号「MEQ第19题」「meq19」），单位列留空或写 `score`。缺题、分数不是这一题能取的值或单位不对时不计算：报告写明原因，退出码 3。`out/result.json` 给出 `rmeq_score` 和 `rmeq_chronotype`。

## 和库里其他昼夜节律技能的关系

rMEQ 问的是偏好的作息时段。`wearable-circadian-aging-biomarker`（七天腕部活动的昼夜参数）和 `circadian-frailty-older-adults`（M10、L5 算相对振幅）测的是实际的休息和活动节律，不能互相代替。

## 报告里要保留的

- 分档是偏好，不是好坏，也不诊断睡眠障碍。
- 不估算褪黑素起始时间，不开几点睡、几点晒光、几点吃饭的处方。
- 引用 `out/report.md`，包括 `边界:` 那一行。
