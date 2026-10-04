---
name: plasma-proteome-future-dementia
description: >-
  Records plasma GFAP, NEFL, GDF15, and LTBP2 when the user supplies them, for the Guo et al. Nature Aging 2024 dementia profile. The protein risk score is a LightGBM model whose weights are not printed, so no risk score is calculated. Use when the user mentions this plasma proteomic dementia profile or those four proteins. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 痴呆相关的四个血浆蛋白

用户交 GFAP 胶质纤维酸性蛋白、NEFL 神经丝轻链、GDF15 生长分化因子 15、LTBP2 潜在转化生长因子结合蛋白 2 的数值，以及现用药和体检。不要向用户要 GEO 或 PDF。

风险分是梯度提升树，权重没有印出来，所以不算风险分。只记下对上的蛋白，不把曲线下面积乘到数值上。现用药对不上时写「不能据此停」。体检不增删这些蛋白。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。

