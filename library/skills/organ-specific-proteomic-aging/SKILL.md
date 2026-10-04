---
name: organ-specific-proteomic-aging
description: >-
  Writes a personal readout of organ-specific proteomic age gaps. It matches supplied proteins to the published organ-clock lists and applies the 1.5 standard-deviation rule to a supplied z score. Use when the user mentions organ-specific proteomic aging clocks, ageotypes, or a UK Biobank organ proteomic clock. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 器官蛋白质年龄差

你交器官的 z、可选的天数、蛋白符号、现用药和体检。报告写天数换成的实足年龄，以及 z 是否越过 1.5 个标准差。蛋白符号只对补充表里的时钟名单。补充表没有 LightGBM 系数，不能把蛋白量算成年龄。报告最后一行是固定边界，不能据此开始或停止任何药物。

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
`--measurements` 用 `organ,z`。若有 `days`，实足年龄按天数除以 365.25。
