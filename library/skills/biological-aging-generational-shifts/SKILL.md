---
name: biological-aging-generational-shifts
description: >-
  Places one person's birth year and supplied aging measures beside the cohort contrasts in Tian et al., Nature Medicine 2026 (DOI 10.1038/s41591-026-04448-w). Use when the user brings age, birth year, and optional PhenoAge or organ-aging gaps and asks about early-onset cancer and generational biological aging. The skill does not compute PhenoAge and does not turn hazard ratios into a personal risk.
---

# 衰老测量对照

用户交年龄、出生年、已经算好的衰老测量、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

同时给出 PhenoAge 和年龄时，报告算未标准化差值。不把队列风险比乘上去。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --age 48 \
  --out out/
```

`MEASUREMENTS.csv` is either one wide row with the columns `age`, `birth_year`, `phenoage`, `kdm_age_gap`, `metabolomic_age_gap`, `immune_aging` and `adipose_aging`, or an `item,value,unit` table with those names as rows. `phenoage` (the phenotypic age from nine routine labs, in years, not its gap) and the age are required. Give the age with `--age`, or as an `age` column or row; `--age` wins when both are given. The other measures are optional and are only recorded. Empty cells stay off the list. `skill.json` lists every name, unit and plausible range. A missing PhenoAge or age, a unit that cannot be converted, a value out of range, or text in a number cell stops the report: it says why, and the script exits with code 3. `out/result.json` holds `phenoage_gap`.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. The report may show an unstandardized PhenoAge difference. Cohort hazard ratios stay in [references/claims.md](references/claims.md).

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
