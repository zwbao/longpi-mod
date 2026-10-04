---
name: time-seq-dna-methylation
description: >-
  Scores methylation percentages with the TIME-seq human blood clock coefficients from the Griffin et al. repository, using predicted age = a * (weighted sum + intercept) + c. Use when the user mentions TIME-seq, a targeted methylation clock, or this Nature Aging paper. Missing CpGs are not mean-imputed. Current medicines and checkup labs do not change the CpG list or the age.
---

# 血液甲基化年龄

用户交甲基化百分比、现用药和体检。不要向用户要 GEO、STRING 或 PDF。系数已经在技能里。

没有甲基化表，位点不全，百分比不在零到一百，或总读数少于十万，就没有年龄。缺位点时不用别人的均值填补。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements methylation.tsv \
  --out out
```

`methylation.tsv` 每行是 `位点 百分比`，可选第三列覆盖度。引用 `out/report.md`，包括 `边界:` 那一行。
