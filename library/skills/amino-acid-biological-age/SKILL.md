---
name: amino-acid-biological-age
description: >-
  Divides each of the eight amino-acid concentrations in the simplified AmiAge model of Ding et al., Nature Communications 2026 (doi:10.1038/s41467-026-73371-y), by the sum of those eight. Use when the user mentions AmiAge, an amino-acid age clock, or this paper. The ratio is computed only when all eight are present. Random-forest weights are not in the repository, so the report does not print an age or an age gap. Checkup labs do not change the amino-acid list.
---

# 氨基酸比例

用户交氨基酸浓度、现用药和体检。不要向用户要随机森林权重或 PDF。生物年龄算不出来。

八个浓度都有时，报告把每个浓度除以这八个的和。缺任何一个就不算比例。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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
