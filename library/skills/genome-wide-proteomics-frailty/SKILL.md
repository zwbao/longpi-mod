---
name: genome-wide-proteomics-frailty
description: >-
  Writes a personal Hospital Frailty Risk Score by summing published ICD-10
  condition weights, then places that sum in a low, intermediate, or high
  bin. Use when the user brings diagnosis codes or an already computed
  score, medicines, or checkup labs and asks about this hospital frailty
  score. The skill does not ask for a reference cohort. It does not turn
  the bin into advice to start or stop a medicine.
---

# 医院衰弱风险分组

用户交诊断编码，或已经算好的医院衰弱风险分，以及现用药和体检。不要向用户要 GEO、STRING 或 PDF。

对上的诊断按已发表权重加总后再分组。同一编码只计一次。没有对上编码时，才使用用户给出的现成分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`--measurements` 用 `item,value,unit` 三列，只有 `item,value` 或 `code,value` 两列也行。诊断一行一个：名称列写补充表 18 的 ICD-10 编码（`F00.1` 这样更细的编码按前三位算）或它的中文、英文病名，数值列写 1（有）或 0（没有），空着或写 yes 也算有。在别处算好的医院衰弱风险分写在 `hfrs` 一行（0–173.2）；对上了编码时不用它。`skill.json` 列出全部 109 个编码、名字和范围。分数不在范围、单位不能换算、读不出来，或同一编码写了两次且不同时不分组：报告写明原因，脚本退出码 3。`out/result.json` 写出 `hfrs_score` 和 `hfrs_group`，对上痴呆相关编码时另有去掉它们后的分数和分组。方法说明见 [references/claims.md](references/claims.md)。
