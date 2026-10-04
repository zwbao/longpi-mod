---
name: apoe2-pericyte-lipid
description: >-
  Looks up user-supplied gene or UniProt symbols in the published significant
  APOE2-vs-APOE3 pericyte proteome table from Kadir et al., Brain 2026, and
  reports each hit's AVG Log2 Ratio. Use when the user mentions APOE2 pericytes,
  pericyte lipid droplets, or this Brain paper. Different from GNPC blood
  proteomic APOE betas. Queue metrics are not personal. Medicines and labs do
  not edit hits.
---

# APOE2 周细胞蛋白质组查表

用户交基因符号或 UniProt，以及可选年龄、现用药和体检。不要向用户要 PDF 或补充 xlsx。技能自带从补充 Table S2（File011 `Signif_APOE2_vs_APOE3`）冻结的 218 个显著蛋白。

报告开头是论文卡片。对得上的符号写出 AVG Log2 Ratio（APOE2/APOE3）与 q 值。这不是个人 Alzheimer 风险或周细胞功能分数。`proteomic-apoe-alzheimers-signatures` 用的是另一篇 GNPC 血蛋白 β，方法不同。现用药对不上时保留「不能据此停」。体检不增删查表命中。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements proteins.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out
```

`proteins.csv` 用 `name,value`（`symbol`/`gene`/`uniprot`）或一列基因名。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
