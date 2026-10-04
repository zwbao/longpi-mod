---
name: mtdna-copy-number-heteroplasmy
description: >-
  Classifies one person's mtDNA variant fractions with the quality-control
  cuts in Gupta et al., Nature 2023, and checks the ten pathogenic variants
  named in Figure 3. Use when the user mentions mtSwirl, blood mtDNA copy
  number, heteroplasmy after age 70, or chrM:302 length heteroplasmy. Adjusted
  copy number is not computed: the blood-composition coefficients are not
  applied. Medicines and checkup labs stay context. The report does not say
  what to start or stop.
---

# 核基因与线粒体拷贝数

用户交变异名和异质性、可选的 chrM:302 比例、拷贝数、污染比例、年龄、现用药和体检。不要向用户要英国生物银行、GEO 或 PDF。

异质性用 0 到 1 的分数。大于 1 且不超过 100 时按百分数换算。低于 0.01 记为参考，低于 0.05 剔除，不低于 0.95 视为纯质。覆盖度低于 100 不能当纯合参考。拷贝数低于 50，或污染比例超过百分之二，按方法标成应剔除的样本。图 3 的十个致病变异对上名字才写入名单。chrM:302 在四个等位基因比例都给出时，参考比例等于 1 减去它们的和。

校正后拷贝数不算。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 75 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。`--medications` 每行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md)。
