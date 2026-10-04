---
name: planarian-regeneration-rejuvenation
description: >-
  Matches supplied names to planarian aging and regeneration markers named by Dai et al., Nature Aging 2025 (doi:10.1038/s43587-025-00847-9), and computes relative head size or hatching ratio only when both numerator and denominator are supplied. Does not invent expression weights. Use when the user mentions planarian regeneration, SOSd, or ectopic eyes in this study.
---

# 涡虫再生与组织回春

你交涡虫研究里的基因或表型名字。若同时给出头部面积和全身面积，或孵化卵囊和卵囊总数，报告按正文的除法算出比值。已打开的补充表是测序汇总，不是 Table 7 的 log2FC，所以不给未点名的基因分类，也不把队列里的孵化率写成你的结果。

不要向用户要 GEO、STRING、PDF 或补充表。不要自造权重。现用药对不上时写「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`，或论文里的项目名。`--medications` 每行一个名字。`--labs` 用 `项目,结果,单位`，只照录。有年龄时加上 `--age`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
