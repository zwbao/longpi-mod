---
name: aging-mouse-brain-atlas
description: >-
  Places one sample's brain-region labels onto the mouse atlas in Hahn et al., Cell 2023 (DOI 10.1016/j.cell.2023.07.027). Use when the user brings dissected brain regions, or expression of the genes the prose names with a direction, and asks about this aging mouse brain atlas or white-matter vulnerability. The full 82-gene common aging signature is not listed in the main text, so this skill does not score that signature.
---

# 小鼠脑区

用户交脑区名字、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

名单包含你点名、且在这张小鼠脑区图上的位置。若给出正文写了方向的基因，也按方向列入，不算 82 基因的共同衰老分数。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`MEASUREMENTS.csv` needs a `region` column, or a `gene` column for the prose-named genes. Names outside the 15 dissected regions, and genes without a printed direction, stay off the list.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. The report may place the supplied regions in the paper's narrative order and repeat the published regional description. It may not give a common-aging score.

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
