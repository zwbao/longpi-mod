---
name: dermal-fibroblast-aging-cytometry
description: >-
  Labels passage 5 and passage 15 human dermal fibroblasts and applies the 0.50 confidence cutoff from Song et al. Use when the user mentions nanosensor chemical cytometry or aging heterogeneity of dermal fibroblasts. Deep-learning weights are not invented. Medicines and checkup labs do not edit the phenotype list.
---

# 真皮成纤维细胞的纳米传感器表型

用户交代次、检测置信度、细胞大小、偏心率、折射率和过氧化氢外流，以及现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。只有第 5 代和第 15 代对上正文的两端参照。置信度要超过 0.50 才算有效检测。四个表型照录，不换成代次。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

