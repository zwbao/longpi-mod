---
name: transcriptomic-hallmarks-mammalian-ageing
description: >-
  Matches one person's transcript measurements to the mortality-clock genes named in Tyshkovskiy et al., Nature 2026 (DOI 10.1038/s41586-026-10542-3). Use when the user brings a gene-expression table and asks about universal transcriptomic hallmarks of mammalian ageing or mortality. Directions come from the prose. Elastic-net coefficients are not in the prose, so this skill does not assign weights or a transcriptomic age.
---

# 转录组特征

用户交基因表达、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

名单只包含你测到、且正文写了方向的基因。不算转录年龄。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`MEASUREMENTS.csv` needs columns `gene` and `value`. Genes outside the prose-named set stay off the list.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. The report may name the matched genes, show the supplied expression, and repeat the direction written in the paper. It may not give a transcriptomic age or a mortality probability.

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
