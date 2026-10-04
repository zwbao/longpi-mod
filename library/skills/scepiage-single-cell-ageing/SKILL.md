---
name: scepiage-single-cell-ageing
description: >-
  Predicts a mouse blood epigenetic age with the scEpiAge rule: sum of log one minus absolute deviation against the blood expected-methylation matrix, then the week at that maximum. Use when the user mentions scEpiAge, single-cell methylation age, or this mouse blood clock. Fewer than five overlapping sites yields no age. Current medicines and checkup labs do not change which sites enter the sum.
---

# 单细胞甲基化周龄

用户交位点甲基化、现用药和体检。不要向用户要 GEO、STRING 或 PDF。血液期望矩阵已经在技能里。

位点不够就没有周龄。主位点缺失时，只用仓库里对应的备份位点。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements sites.tsv \
  --out out
```

`sites.tsv` 每行是 `染色体:位置 甲基化`。引用 `out/report.md`，包括 `边界:` 那一行。
