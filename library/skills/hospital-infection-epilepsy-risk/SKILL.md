---
name: hospital-infection-epilepsy-risk
description: >-
  Looks up the published odds ratios for hospital-treated infection and later-life epilepsy from Zhuang et al., Nature Aging 2025 (doi:10.1038/s43587-025-01005-x). Use when the user mentions infection history, late-onset epilepsy, or this nested case-control study. The readout quotes Figure 1 and the results text for the stated window or site. It does not multiply ratios into a personal probability, and checkup labs do not add exposures.
---

# 感染与晚年癫痫

用户交感染距指数日的年数、部位、现用药和体检。不要向用户要登记数据或 PDF。

报告只对照你给出的时间窗或部位，放上论文里对应的一条队列比值比。几条比值比不相乘。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用 `name,value,unit` 三列，只有 `name,value` 两列或没有表头也行。`years` 是感染距指数日的年数，按月记的在单位列写 `mo`；`site`、`cohort`、`cvd_prs`、`cvd_score`、`cvd_history` 写词，能写的词见 `skill.json`。年数不在 0–100 之间、单位不能换算、读不出来，同一项写了两次且不同，或 `cohort` 不是 `ukb`、`sweden` 时不对照：报告写明原因，脚本退出码 3。`out/result.json` 写出 `infection_window`（时间窗；没有年数时为空），队列比值比只写在报告里。方法说明见 [references/claims.md](references/claims.md)。
