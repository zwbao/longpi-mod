---
name: muscle-regeneration-lifespan
description: >-
  Classifies a supplied one-way FBR senescence score from Walter et al.,
  Nature Aging 2024, against the published senescent-like cutoff. Use when
  the user mentions muscle regeneration across lifespan, MuSC senescence
  scoring, or the FBR escape score. Supplementary Table 2 logFC values are
  not used as weights. Medicines and checkup labs do not change the call.
---

# 肌肉再生的干细胞状态

用户交测量、现用药、体检，以及可选的年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。只有交来的单向 FBR 衰老分能对照正文的界。Supplementary Table 2 的 logFC 不是权重。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用 `name,value`，或一行一个论文里的项目名。引用 `out/report.md`，包括最后一行 `边界:`。
