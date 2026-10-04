---
name: parabiosis-brain-transcriptome
description: >-
  Matches supplied gene names to endothelial and parabiosis genes named by Ximerakis et al., Nature Aging 2023 (doi:10.1038/s43587-023-00373-6), and records the direction written in the text. Does not invent log fold-change weights. Use when the user mentions heterochronic parabiosis of the mouse brain, Klf6, or Hspa1a in this study. Supplementary Table 14 is not applied.
---

# 异时联体脑转录组

你交基因符号、可选的现用药和体检。报告只核对 Ximerakis 等正文写明方向的基因，以及图 4e 点名但没有逐个写出符号的标签。已打开的两份表是细胞标记和方差分析，不是 Supplementary Table 14，所以不补倍数，也不把小鼠对比写成你的分数。

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
