---
name: gdf11-neuronal-autophagy
description: >-
  Records one person's serum growth-differentiation-factor concentration and states that Moigneu et al., Nature Aging 2023, published group comparisons rather than a classification threshold. It does not turn the aged-mouse injection into a personal dose. Use when the user mentions this GDF11 autophagy paper, serum GDF11 or BMP11 in depression, or the Pelotas young-adult sample. Current medicines and checkup labs stay context.
---

# 血清生长分化因子与神经元自噬

你交血清生长分化因子的浓度时，报告照录这个数。论文写的是组间比较，没有判别阈值列，所以不分类。小鼠的注射方案不写成用法。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删这个标志物。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

浓度单位用 pg/ml，字段名 `serum_gdf11_pg_ml`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
