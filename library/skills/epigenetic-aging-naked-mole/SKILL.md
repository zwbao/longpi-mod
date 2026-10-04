---
name: epigenetic-aging-naked-mole
description: >-
  Reports relative age on the maximum-lifespan scale and, when all 26 blood CpG values are supplied, methylation age from Supplementary Data 4 of Kerepesi et al. Use when the user mentions the naked mole-rat epigenetic clock, NMR methylation age, or this Nature Communications study. Missing sites are not filled with zero. Medicines and checkup labs do not edit the gene list.
---

# 裸鼹鼠血液时钟

用户交实足年龄、物种、26 个血液位点的甲基化（0 到 1）、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。有实足年龄时给出相对年龄。26 个位点到齐时，按 Supplementary Data 4 的 Clock1 权重计算甲基化年龄。缺位点不填补，不算甲基化年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements measures.txt \
  --out out
```

引用 `out/report.md`，包括 `边界:` 那一行。
