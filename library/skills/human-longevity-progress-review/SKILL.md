---
name: human-longevity-progress-review
description: >-
  Checks whether a gene or variant the user names is stated by Bonnet et al.,
  Nature Communications 2026 (doi:10.1038/s41467-026-68828-z). Use when the
  user mentions this review of sustainable progress in human longevity or
  regional life expectancy in Western Europe. The review names no gene or
  variant, so the matched list stays empty. Labs do not add names.
---

# 人类寿命进展里对得上的基因

用户交基因或变异名、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。报告开头是论文卡片。这篇综述没有点名基因或变异，方法名单保持为空。

现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。方法说明见 [references/claims.md](references/claims.md)。
