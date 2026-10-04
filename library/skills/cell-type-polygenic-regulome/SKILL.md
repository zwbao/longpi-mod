---
name: cell-type-polygenic-regulome
description: >-
  Writes a personal readout of trait-associated regulon scores from Ma et al., Nature Aging 2026. It applies the published TRS formula to supplied cell-type specificity and genetic relevance scores. Use when the user mentions scMORE, eRegulons, polygenic single-cell regulomes, or this immune and aging GWAS integration. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 细胞类型里的调控子

你交调控子的细胞类型特异性和遗传相关性。报告按公式算出得分，从高到低排列。两个分数缺一个时，报告说明没有算出得分。

不要向用户要 GWAS 或 PDF。没有零分布，就不写经验 P 值。现用药对不上时写「不能据此停」。体检不增删调控子。

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

