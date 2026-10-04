---
name: selective-senolytic-platform
description: >-
  Computes the selectivity index as LC50 divided by IC50 from Magkouta et al., Nature Aging 2025, when both concentrations are supplied. Use when the user mentions mGL392, GL392, a Sudan Black B senolytic micelle, or lipofuscin-directed dasatinib. Mouse milligram amounts are experimental. The report does not say what to start or stop.
---

# 脂褐素导向的清除平台

你交 IC50 和 LC50。两个都是正数时，报告写出选择性指数。补充笔记里的存活百分比不拿来拟合半数浓度。

不要向用户要 GEO、STRING、PDF 或补充表。每只小鼠的毫克数是实验用量。现用药对不上时写「不能据此停」。体检不增删名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out
```

`measurements.csv` 用 `name,value`，名字用 `ic50` 和 `lc50`。方法说明见 [references/claims.md](references/claims.md)。

