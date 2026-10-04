---
name: organ-aging-plasma-proteome
description: >-
  Checks whether one SomaScan profile contains every organ-enriched protein required by the Oh et al. Nature 2023 organ-age models (DOI 10.1038/s41586-023-06802-1). Use when the user brings SeqIds and asks about plasma organ aging or organage. LASSO weights stay in the organage pickles and are not copied here, so this skill does not emit an organ age.
---

# 器官蛋白齐套

用户交 SomaScan 序列号、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告只标出模型蛋白已经到齐的器官，不算器官年龄。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`MEASUREMENTS.csv` needs a `seqid` column. An organ enters the list only when every protein in that organ's published set is present.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. The report may name organs whose protein sets are complete. It may not give an organ age.

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
