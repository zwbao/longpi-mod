---
name: nanopore-parent-origin-methylation
description: >-
  Writes a personal nanopore methylation age from published lasso
  coefficients when standardized methylation is supplied, and also reports
  methylation-age error and parent-of-origin differences when those values
  are supplied. Use when the user brings methylation measurements,
  medicines, or checkup labs for this parent-of-origin methylation clock.
  The skill does not rescale raw methylation proportions. It does not turn
  the result into advice to start or stop a medicine.
---

# 印记位点甲基化读出

用户交标准化后的甲基化，或已经算好的甲基化年龄和实足年龄，或某个位点的父本和母本甲基化，以及现用药和体检。不要向用户要 GEO、STRING 或 PDF。

标准化数值按已发表的套索系数算甲基化年龄，没测到的位点按 0 代入。训练均值和标准差不在表里，所以原始比例不会重缩放。也可以算绝对误差和父本减母本。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`--measurements` 用两列 `item,value`，除非下面另说。方法说明见 [references/claims.md](references/claims.md)。
