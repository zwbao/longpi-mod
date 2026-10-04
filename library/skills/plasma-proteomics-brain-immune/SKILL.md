---
name: plasma-proteomics-brain-immune
description: >-
  Writes a personal organ-age readout from plasma proteins. It applies the published linear coefficients to z-scored protein levels, and the 1.5 standard-deviation rule when a z-scored organ gap is supplied. Use when the user mentions organ age, plasma proteomic brain or immune aging, or a UK Biobank Olink organ clock. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 器官年龄差

你交蛋白的 z 分数（基因符号）或已经算好的器官 z，以及现用药和体检。蛋白 z 分数按补充表的线性系数加截距得到预测年龄。只有器官 z 时，按 1.5 个标准差标出极端一侧。现用药和体检不改名单。报告最后一行是固定边界，不能据此开始或停止任何药物。

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
`--measurements` 可以是 `item,value` 的蛋白 z 分数，或 `organ,z`。器官可用英文或中文。蛋白量要已经是 z 分数。没有交齐一个模型的全部非零蛋白，就不报那个器官的预测年龄。
