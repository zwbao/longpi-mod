---
name: parabiosis-noncoding-rna-aging
description: >-
  Matches supplied microRNA and extracellular-matrix gene names to the eight global aging microRNAs named by Wagner et al., Nature Biotechnology 2024 (doi:10.1038/s41587-023-01751-6), and records the direction written in the text. Does not invent Spearman weights. Use when the user mentions miR-29c-3p, heterochronic parabiosis noncoding RNA, or this mouse tissue ncRNA aging map. Supplementary Table 8 correlation columns are not applied.
---

# 非编码核糖核酸衰老轨迹

你交 miRNA 或靶基因名字、可选的现用药和体检。报告只核对 Wagner 等正文点名的八个全局衰老 miRNA，以及 Eln、Col1a1、Col3a1 这三个共有靶点，并写下正文里的方向。Supplementary Table 8 已打开，各组织的 corr 是小鼠相关，不把你的表达值乘上去。

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
