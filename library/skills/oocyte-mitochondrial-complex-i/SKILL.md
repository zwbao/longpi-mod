---
name: oocyte-mitochondrial-complex-i
description: >-
  Places a supplied oocyte stage into the complex I assembly and rotenone-survival groups printed for early and late oocytes. Use when the user mentions oocyte complex I suppression, ROS-free oocyte mitochondria, or doi:10.1038/s41586-022-04979-5. Supplementary Table 1 has replicate abundances and no intercept, so no personal protein score is calculated. Labs do not change the stage list.
---

# 卵母细胞线粒体复合体

用户交卵母细胞阶段、现用药和体检。有年龄可一并交来。不要向用户要 PRIDE、GEO、STRING 或 PDF。报告开头是论文卡片。

Supplementary Table 1 是重复样本的蛋白丰度，没有截距，所以不算个人蛋白分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 30 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。阶段写 `stage,I`。方法说明见 [references/claims.md](references/claims.md)。
