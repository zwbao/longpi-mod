---
name: tcell-age-molecular-reprogramming
description: >-
  Matches supplied gene and subset names to age-related T cell markers named by Thomson et al., Nature Immunology 2023 (doi:10.1038/s41590-023-01641-8), including the pediatric MNP-2 signature. Does not invent frequency weights. Use when the user mentions TEA-seq, MNP-2, SOX4, or TOX in this T cell aging study.
---

# T细胞年龄分子重编程

你交基因或亚群名字、可选的现用药和体检。报告只核对 Thomson 等正文写明随年龄升高或下降的名字，包括 MNP-2 和初始 CD4 T 细胞的儿童签名。Supplementary Table 2 已打开，初始 CD8 的 avg_log2FC 不把组频率当成你的阈值。

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
