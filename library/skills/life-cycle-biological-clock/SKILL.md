---
name: life-cycle-biological-clock
description: >-
  Reads one person's routine clinical indicators against the pediatric and adult LifeClock drivers named in Wang et al., Nature Medicine 2025 (DOI 10.1038/s41591-025-04006-w). Use when the user brings age plus checkup or EHR labs and asks about this full life-cycle biological clock, LifeClock, or EHRFormer. It does not estimate biological age: the paper text and the EHRFormer training repository do not contain the clock weights. If the user also supplies a standardized age difference and is over 18 years, it places that difference in the paper's adult bands of within 1 standard deviation or above 3.
---

# 临床时钟对照

用户交年龄、常规检验、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

没有年龄时不对照，报告写明缺年龄。有年龄时只对照正文点过名的检验，不算生物年龄。若同时给出标准化年龄差且年龄超过 18 岁，按正文的成人分档放入名单。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --age 40 \
  --out out/
```

`MEASUREMENTS.csv` has the columns `indicator,value,unit`; `indicator,value` alone also works. Give the age with `--age`, or in a row with indicator `age` or `年龄`; `--age` wins when both are given. The age is required and must be 0–110 years. An optional row `standardized_age_difference` (in standard deviations, as LifeClock computes it; the model is not public) is placed in the adult bands only when age is over 18. Other rows are lab names such as urea, albumin, RDW, AST, creatinine, or total protein. `skill.json` lists every accepted name, unit, conversion and plausible range; the list shows each value in that unit and does not judge it. Glucose is not one of the Fig. 2 drivers, so it stays off the list. A missing age, a unit that cannot be converted, a value out of range, or text in a number cell stops the report: it says why, and the script exits with code 3. `out/result.json` holds `adult_band`.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. The list is the Fig. 2 drivers for that age band which the user actually measured, in the paper's order. It may say which of those drivers were measured and the direction the paper stated. It may not state a biological age, an age gap, or whether this visit is high or low.

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
