---
name: oral-microbiome-signatures
description: >-
  Writes a personal oral microbiome aging readout. It reports a supplied residual and matches genus names to the published age-associated list. Use when the user mentions the OMAA Score, an oral microbiome aging clock, or an oral rinse biological age. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 口腔微生物年龄加速

你交属的名字或已经算好的残差、现用药和体检。报告写残差相对 0 的方向，并列出对上的年龄相关属。补充表没有随机森林权重，不能把丰度算成年龄。药写在下一节，对不上就写不能据此停。报告最后一行是固定边界，不能据此开始或停止任何药物。

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
`--measurements` 用 `item,value`。`omaa` 是已经算好的残差。属名写在 `item` 列。
