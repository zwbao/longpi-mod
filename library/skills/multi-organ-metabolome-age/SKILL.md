---
name: multi-organ-metabolome-age
description: >-
  Writes a personal uncorrected metabolomic age gap. It subtracts chronological age from a supplied predicted age for five organ systems. Use when the user mentions MetBAG, multi-organ metabolome biological age, or a Nightingale metabolome clock. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 代谢组器官年龄差

你交器官的预测年龄、实足年龄、现用药和体检。报告先写预测年龄减去实足年龄，这是校正前的差。全文和补充说明没有带代谢物名字的模型系数，不能从代谢物重算预测年龄。报告最后一行是固定边界，不能据此开始或停止任何药物。

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
