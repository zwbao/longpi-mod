---
name: mri-multi-organ-clocks
description: >-
  Writes a personal uncorrected MRI organ age gap. It subtracts chronological age from a supplied predicted age for seven organs. Use when the user mentions MRIBAG, MRI organ clocks, or a multi-organ MRI biological age. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 磁共振器官年龄差

你交器官的预测年龄、实足年龄、现用药和体检。报告先写预测年龄减去实足年龄，这是校正前的差。预训练系数文件没有影像指标名字，不能把影像测量乘进去。报告最后一行是固定边界，不能据此开始或停止任何药物。

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
`--measurements` 用 `organ,predicted_age`，`--age` 是实足年龄。
