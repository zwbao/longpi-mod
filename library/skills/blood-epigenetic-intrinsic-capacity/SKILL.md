---
name: blood-epigenetic-intrinsic-capacity
description: >-
  Writes a personal intrinsic-capacity readout from blood methylation. It applies the published CpG coefficients and intercept when every site is supplied, and it keeps a rescaled clinical average separate from that methylation score. Use when the user mentions the IC clock, DNAm intrinsic capacity, or a blood epigenetic intrinsic-capacity clock. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 内在能力

你交甲基化 beta（cg 号），或认知、行走、情绪、视力、听力的分数，以及现用药和体检。位点到齐时，报告用补充表的系数和截距算甲基化内在能力。只有临床分数时，四项按满分缩放的平均会标明不是这条甲基化公式。报告最后一行是固定边界，不能据此开始或停止任何药物。

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
`--measurements` 用 `item,value`。甲基化行的 `item` 是 cg 号。临床分数可用 `mmse`、`sppb`、`phq9`、`vision`、`hearing`。
