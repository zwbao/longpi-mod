---
name: iief5-erectile-function
description: >-
  Scores the IIEF-5 (Sexual Health Inventory for Men; Rosen et al. 1999) for one man: five item scores of 1 to 5
  over the past 6 months, total 5 to 25, and the published severity band (none 22-25, mild 17-21, mild to
  moderate 12-16, moderate 8-11, severe 5-7). A score of 21 or less is referred to a urologist with a
  cardiovascular risk check. Men who attempted intercourse only. Use for 勃起, 阳痿, 性功能, ED, IIEF-5 or SHIM.
  Item wording is copyrighted (Pfizer, distributed by Mapi Research Trust) and is not reproduced.
---

# IIEF-5 勃起功能问卷

用户交 5 道题的得分、性别，可选年龄和「过去 6 个月是否尝试过性交」。不要向用户要论文 PDF。

## 怎么问、怎么填

题目原文受版权保护（Pfizer 所有，Mapi Research Trust 发放），技能里没有收录。请用户用正式问卷作答（医院男科或泌尿外科常用的版本），再把每题的得分交来。每题 1–5 分，分越高功能越好；问的是过去 6 个月。

| 题号 | 主题 |
| --- | --- |
| 1 | 对能勃起并维持勃起的信心 |
| 2 | 受到性刺激时，勃起硬度够不够插入 |
| 3 | 插入以后能不能维持勃起 |
| 4 | 维持勃起直到性交结束有多难 |
| 5 | 尝试性交时，自己满意的次数 |

问卷只适用于过去 6 个月尝试过性交的男性。填了 0 分（完整版 IIEF 的「没有性活动」「没有尝试性交」）、`--attempted no` 或 `--sex female` 时不计算，退出码 3。

## Command

```bash
python "$SKILL/scripts/personal_report.py" --measurements iief5.csv --sex male --age 52 --attempted yes --out out
```

`iief5.csv` 用表头 `item,value,unit`，名称写 `iief5_item1` 到 `iief5_item5`（也认「第1题」「q1」），单位列留空或写 `score`。缺题、超出 1–5、不是整数或单位不对时不计算：报告写明原因，退出码 3。`out/result.json` 给出 `iief5_score` 和 `iief5_band`。

## 报告里要保留的

- 分档用「提示可能存在……，请医生评估」，不说「你患有」。
- 21 分及以下：看男科或泌尿外科，同时做心血管风险评估；年龄 35–74 岁时可以接着用 `china-par-ascvd-risk`。
- 不推荐药物，不说停药或换药；现用药的问题交给开药的医生或药师。
- 引用 `out/report.md`，包括 `边界:` 那一行。
