---
name: replicative-senescence-proteome
description: >-
  Looks up user-supplied gene or UniProt symbols in the published equal-cell
  significant proteome table from da Silva Fernandes et al., Nature
  Communications 2026, and reports each hit's senescence cluster and
  Age4/Age1 log2 fold change. Use when the user mentions replicative
  senescence proteomics, IMR90 proteome remodeling, or this Nat Commun paper.
  Queue metrics are not personal. Medicines and checkup labs do not edit hits.
---

# 复制性衰老蛋白质组查表

用户交基因符号或 UniProt 名单，以及可选的年龄、现用药和体检。不要向用户要 PRIDE、ArrayExpress、PDF 或补充 xlsx。技能自带从 Supplementary Data 1（MOESM3）`Proteome_equal_cell_number` 冻结的显著性子集。

报告开头是论文卡片。对得上的符号写出正文阈值下的 Cluster（Increased / Decreased in senescence）和 mean log2(Age4/Age1)。对不上的写明不在该显著性子集。这不是个人衰老诊断，也不根据体检改查表结果。现用药对不上时保留「不能据此停」。

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

`proteins.csv` 用 `name,value` 或一列 `symbol` / `uniprot` / `gene`。`name` 写 `symbol` 或 `uniprot` 时，`value` 为标识符；也可以每行一个符号。PDF、IDAT 和其他读不了的格式会要求改交表格。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
