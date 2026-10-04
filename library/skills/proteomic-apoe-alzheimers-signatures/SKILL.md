---
name: proteomic-apoe-alzheimers-signatures
description: >-
  Ranks a person's protein symbols by the GNPC Model type 1 standardized betas for APOE2 or APOE4 versus ε3/ε3 from Lu et al., Nature Aging 2026 (doi:10.1038/s43587-026-01123-0). Use when the user mentions APOE proteomic signatures, ε2, ε4, or this paper. Only proteins with FDR below 0.05 in the paper's result tables are listed. Checkup labs do not add proteins, and the beta is not a personal effect.
---

# 载脂蛋白蛋白名单

用户交基因型（e2 或 e4）和蛋白符号、现用药和体检。不要向用户要原始队列或 PDF。系数不是这个人的蛋白效应。

报告只按标准化系数的绝对值，把你点到的蛋白从大到小排列。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`measurements.csv` 用两列 `name,value`，其中一行是 `genotype,e2` 或 `genotype,e4`。方法说明见 [references/claims.md](references/claims.md)。
