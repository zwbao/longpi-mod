---
name: senescent-macrophage-muscle-atrophy
description: >-
  Applies the written skeletal-muscle assay formulas from Xiang et al.,
  Nature Aging 2025, when every input column is present, and lists the
  in-vivo compound names without a personal dose. Use when the user mentions
  senescent macrophages, ferroptosis, osteoarthritis muscle atrophy, or
  coenzyme Q10 in that experiment. The printed MyHC-IIa ratio is not
  corrected. Checkup labs do not add names to the method list.
---

# 衰老巨噬细胞与肌萎缩

用户交测量、现用药、体检，以及可选的年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。测定式只在每一列都有时才算。小鼠实验里的化合物没有个人剂量。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用 `name,value`。引用 `out/report.md`，包括最后一行 `边界:`。
