---
name: biomarker-panels-proteomic-profiling
description: >-
  Matches one person's protein names to the cerebral small-vessel disease panels named in the main text of Hristovska et al., Nature Aging 2026 (doi:10.1038/s43587-026-01081-7). Use when the user mentions cSVD proteomics, white-matter lesions, MMP12, or this paper. Directions are the ones printed in the results text. The sample R code does not contain the fitted coefficients, and checkup labs do not add proteins.
---

# 脑小血管病蛋白

用户交蛋白符号和数值、现用药和体检。不要向用户要回归系数或 PDF。

报告只保留你测到、且正文点了名的蛋白，并写上正文给出的方向。不加权重。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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
