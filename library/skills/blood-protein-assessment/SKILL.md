---
name: blood-protein-assessment
description: >-
  Writes a personal protein-score readout. It sums the published elastic-net coefficients times supplied scaled protein levels for each outcome whose proteins are all present. Use when the user mentions ProteinScore, blood protein incident disease, or a UK Biobank proteomic risk score. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 血液蛋白与发病

你交已经缩放到均值 0、标准差 1 的蛋白量、现用药和体检。某个结局的蛋白到齐时，报告用补充表的系数加总成线性预测值。糖化血红蛋白只写在第一段，不增删这个名单。报告最后一行是固定边界，不能据此开始或停止任何药物。

不要向用户要 GEO、STRING、UK Biobank 或 PDF。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```
`--measurements` 用 `item,value`。蛋白用基因符号，数值是模型里的缩放量。`hba1c` 的单位沿用 mmol/mol。
