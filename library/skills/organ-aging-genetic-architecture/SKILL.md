---
name: organ-aging-genetic-architecture
description: >-
  Lists which of the 13 organs in Zhu et al., Nature Communications 2026 (doi:10.1038/s41467-025-67223-4) the user named, and attaches the Mendelian-randomization directions printed in the abstract. Use when the user mentions this organ-aging GWAS, the 119 organ-aging loci, or smoking initiation linked to lung, intestine, kidney, or stomach aging. Supplementary Data 3 has feature weights and no intercept, so no organ age is printed. Labs do not add organs.
---

# 器官衰老遗传结构

用户交点到的器官名字、现用药和体检。不要向用户要弹性网权重或 PDF。报告开头是论文卡片。Supplementary Data 3 有特征权重，没有截距，所以不算器官生物年龄。

报告只列出你点到的器官。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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
