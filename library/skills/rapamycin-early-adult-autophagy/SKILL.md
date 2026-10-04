---
name: rapamycin-early-adult-autophagy
description: >-
  Writes a personal readout of intestinal epithelial turnover from Juricic et al., Nature Aging 2022, as supplied GFP-marked gut area divided by total gut area. Use when the user mentions brief early-adult rapamycin, rapamycin memory, intestinal autophagy, LManV, lysozyme, or Man2B1. Food concentrations in the preset are experimental. The report does not say what to start or stop.
---

# 短暂雷帕霉素与肠自噬

你交肠段的绿色荧光面积和总面积。两者都是正数时，报告写出更新比例。弥漫溶菌酶计数到齐时，报告写出比例。寿命表里的风险比不算到这个人身上。

不要向用户要 GEO、STRING、PDF 或补充表。果蝇和小鼠的浓度是实验条件。现用药对不上时写「不能据此停」。体检不增删名单。

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

`measurements.csv` 用 `name,value`。面积列名用 `gfp_area` 和 `total_area`。方法说明见 [references/claims.md](references/claims.md)。

