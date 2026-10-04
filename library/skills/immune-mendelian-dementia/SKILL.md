---
name: immune-mendelian-dementia
description: >-
  Writes a personal readout of medication categories from an immune Mendelian-randomization dementia analysis. It checks whether current medicines are among the six studied classes and does not turn the cohort hazard ratio into a personal score. Use when the user mentions dementia autoimmunity, methotrexate and dementia, or this kind of triangulation. Checkup labs are context. The report does not say what to start or stop.
---

# 痴呆研究里的用药类别

你交现用药和体检。报告先说明没有能乘到一个人测量上的系数，所以没有个人风险比。药写在下一节：对上研究过的类别，或写明名单里没有这个名字，两句都保留不能据此停。体检不改方法名单。报告最后一行是固定边界，不能据此开始或停止任何药物。

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
`--medications` 每行一个药名。
