---
name: neurodegeneration-proteomics-biomarker
description: >-
  Matches one plasma protein panel to proteins named with a direction in the GNPC vignette of Imam et al., Nature Medicine 2025 (DOI 10.1038/s41591-025-03834-0). Use when the user brings plasma proteins and asks about this neurodegeneration proteomics consortium or its AD, FTD, or APOE findings. It repeats printed directions, including proteins elevated in AD plasma such as ACHE. Effect sizes are not copied because the prose does not print them.
---

# 神经退行蛋白

用户交血浆蛋白名字和数值、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

名单只包含你测到、且正文点过名的蛋白。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`MEASUREMENTS.csv` needs a `protein` column and may include `value`. Proteins the vignette does not name stay off the list.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. The report may repeat the direction written for a matched protein. It may not give a fold change or a drug target rank.

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
