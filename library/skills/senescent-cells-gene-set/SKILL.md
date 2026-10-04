---
name: senescent-cells-gene-set
description: >-
  Scores one gene-expression table against the SenMayo set of 125 genes from Saul et al., Nature Communications 2022. Matched symbols are written with readable gene names and the supplement class. It does not invent gene weights. Use when the user mentions SenMayo, a senescence gene set, or scoring expression against this senescence panel. Medicines and checkup labs stay context. The report does not say what to start or stop.
---

# 衰老相关基因

你交一份基因表达表，以及可选的现用药和体检。对上的基因用中文名和补充数据里的分类写进名单。有其他已测基因时，报告写出没有权重的平均表达差。没有对上的表达，报告说明这次没有算出名单。

不要向用户要 GEO、STRING 或 PDF。不要另造基因权重。现用药对不上时写「不能据此停」。体检不增删名单。

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

`--measurements` 用两列 `gene,value` 或 `item,value`。`--medications` 每行一个药名。`--labs` 原样写入报告。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。

