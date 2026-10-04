---
name: mammal-somatic-mutation-lifespan
description: >-
  Divides one crypt's substitution count by age and looks up the species
  mean rate and Lifespan_80 from Cagan et al., Nature 2022. Use when the
  user mentions somatic mutation rates across mammals, end-of-lifespan
  burden, or this intestinal-crypt study. The published slope is only
  applied to substitutions. Medicines and checkup labs stay context.
---

# 哺乳动物体细胞突变率

你交物种、隐窝替换数和年龄，也可以交现用药和体检。不要向用户要 EGA、PDF 或补充表。

年替换率是替换数除以年龄。物种能对上时，报告 Supplementary Table 3 的年均替换率和 Table 6 的 Lifespan_80，并用 Fig. 3c 的斜率除以寿命。插入缺失不用这条斜率。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 40 \
  --out out
```

`measurements.csv` 用 `name,value`。物种例如 `human`。替换数写 `substitution_burden`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
