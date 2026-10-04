---
name: senescent-glia-mitochondria-lipid
description: >-
  Matches one measurement table to the AP1-positive glia markers printed in
  Figure 1 of Byrns et al., Nature 2024, and applies the published climbing
  assay and lipid directions. Use when the user mentions senescent glia,
  AP1-positive glia, glial lipid droplets, or ND42. Supplementary Data 1
  fold changes are not used as weights. Medicines and checkup labs stay
  context. The report does not say what to start or stop.
---

# 衰老胶质与脂质堆积

用户交图 1 点名的标志、可选的爬管高度、热击存活和两类脂质，以及现用药和体检。不要向用户要 GEO、STRING 或 PDF。

对上的标志写入名单，不另造权重。爬管高度换成最大瓶高 8 cm 的百分比。游离脂肪酸和三酰甘油在两侧都给出时，只对照图 4 的方向。错误发现率低于 0.10 的脂质按脂质组阈值记一笔。

现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

`measurements.csv` 用两列 `name,value`。`--medications` 每行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md)。
