---
name: ovarian-ageing-cancer-mutation
description: >-
  Reports age-at-menopause shifts for rare-variant carrier classes the user names. Use when the user mentions ovarian ageing, de novo mutation rates, SAMHD1, ZNF518A, PALB2, or doi:10.1038/s41586-024-07931-x. Main-text years are used when printed; PALB2 and PNPLA8 use the winsorized BOLT beta in Supplementary Table 2. Labs do not change the gene list.
---

# 卵巢衰老与癌症突变

用户交基因和变异掩码、现用药和体检。有年龄或性别可写在测量文件里。不要向用户要 UK Biobank、GEO、STRING 或 PDF。报告开头是论文卡片。

正文写出年数的基因按那个年数照录。PALB2 和 PNPLA8 用 Supplementary Table 2 里 34 岁截尾 BOLT 的 Beta 和标准误。没有截距，所以不算预测绝经年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 52 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。例如 `ZNF518A,HC-PTV`，性别写 `sex,female`。方法说明见 [references/claims.md](references/claims.md)。
