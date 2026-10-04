---
name: serum-proteomics-apoe-signatures
description: >-
  Reads APOE genotype and the four serum proteins named by Frick et al., Nature Aging 2024, and states the published APOE-dependent direction. It does not invent hazard ratios. Use when the user mentions these APOE-dependent serum proteins or this AGES proteomics paper. Medicines and checkup labs stay context.
---

# 载脂蛋白相关的血清蛋白

你交 APOE 基因型，也可以交四个血清蛋白的数值。报告照录数值，不乘权重，也不做风险分。没有基因型和数值时，报告说明没有照录方向。

不要向用户要 GEO 或 PDF。不要另造回归系数。现用药对不上时写「不能据此停」。体检不增删这四个蛋白。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

`--measurements` 用 `item,value`。`apoe` 例如 e3/e4。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
