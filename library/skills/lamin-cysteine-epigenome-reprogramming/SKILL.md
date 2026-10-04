---
name: lamin-cysteine-epigenome-reprogramming
description: >-
  Matches supplied enzyme, metabolite, and histone-mark names to those named by Wang et al., Nature Metabolism 2026 (doi:10.1038/s42255-025-01443-2), and records the direction written for lamin A/C and cysteine flux. Does not invent flux weights. Use when the user mentions lamin A/C, CTH, CBS, or cysteine catabolism in this stem-cell study.
---

# 核纤层半胱氨酸与干细胞命运

你交酶、代谢物或组蛋白标记的名字，以及可选的现用药和体检。报告只写下 Wang 等正文里的方向。Supplementary Table 1 已打开，强度是胚胎干细胞重复，不把化验值换算成乙酰化。实验试剂如果出现在现用药里，只保留「不能据此停」。

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
