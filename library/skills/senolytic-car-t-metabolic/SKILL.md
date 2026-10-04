---
name: senolytic-car-t-metabolic
description: >-
  Applies the dual-control P-value rule from Amor et al., Nature Aging 2024, to two supplied P values for uPAR CAR T comparisons. Use when the user mentions senolytic CAR T cells, uPAR, m.uPAR-m.28z, or metabolic readouts after those cells. Glucose tolerance area is not computed because the source data have no area coefficient. The report does not say what to start or stop.
---

# 尿激酶受体的嵌合抗原受体

你交相对未转导 T 细胞和相对人 CD19 对照的两个 P 值。两个都低于论文写的阈值时，报告记为有差别；只有一个低于阈值时记为不确定。

不要向用户要 GEO、STRING、PDF 或补充表。细胞数和糖负荷是小鼠实验。现用药对不上时写「不能据此停」。体检不增删名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out
```

`measurements.csv` 用 `name,value`，名字用 `p_ut` 和 `p_h19`。方法说明见 [references/claims.md](references/claims.md)。

