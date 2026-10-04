---
name: bowhead-whale-dna-repair
description: >-
  Computes the NHEJ reporter frequency as GFP-positive over DsRed-positive
  counts and lists the fibroblast transformation combinations from Firsanov
  et al., Nature 2025. Use when the user mentions bowhead whale DNA repair,
  CIRBP, or this study. CIRBP abundance is not turned into a score. Medicines
  and checkup labs stay context and do not change the list.
---

# 弓头鲸修复读出

你交物种、GFP 阳性计数和 DsRed 阳性计数，也可以交现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

报告计算 Fig. 4 的连接频率，并照录这篇成纤维细胞实验的转化组合。CIRBP 没有系数列，不算分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`measurements.csv` 用 `name,value`。物种写 `human` 或 `bowhead`。连接频率用 `gfp` 和 `dsred`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
