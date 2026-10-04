---
name: plasma-proteome-dementia-biomarkers
description: >-
  Matches one person's protein symbols to the dementia plasma markers named with a direction in Bellomo et al., Nature Aging 2026 (doi:10.1038/s43587-026-01162-7). Use when the user mentions bPRIDE, GFAP, ITGAV, or differential dementia proteomics. Logistic coefficients stay in Supplementary Table 6, so they are not applied. Checkup labs do not add proteins.
---

# 痴呆血浆蛋白

用户交蛋白符号和数值、现用药和体检。不要向用户要逻辑回归系数或 PDF。

报告只留下你测到、且正文写了方向的蛋白。不把蛋白加成一个分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`measurements.csv` 用两列 `name,value`。方法说明见 [references/claims.md](references/claims.md)。
