---
name: structural-signature-plasma-proteins
description: >-
  Writes a personal readout of plasma lysine accessibility for the C1QA, clusterin, and ApoB peptides named by Son et al. Supplied peptide values are recorded without a class, because the classifier weights are not printed. A supplied proteome-wide accessibility is compared with the published group means. Use when the user mentions this structural signature of plasma proteins, covalent protein profiling, or the three-protein Alzheimer panel. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 血浆蛋白的结构可及性

你交三个肽段的可及性，也可以另交一份整体可及性。三个肽段只照录。整体可及性才和论文里跨肽段的组平均比较。这不是诊断。没有数值时，报告说明没有分类。

不要向用户要 GEO 或 PDF。不要套用未发表的分类器权重。现用药对不上时写「不能据此停」。体检不增删这三个蛋白。

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

