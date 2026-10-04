---
name: elastin-fragments-innate-aging
description: >-
  Assigns one serum elastin-fragment concentration to the high or normal group
  using the published picogram cutoffs, and checks a peptide against the
  published sequences. It does not fit an age regression and does not invent
  weights. Use when the user mentions elastin fragments, the E-motif, or
  innate immune activation by matrix fragments. Medicines and checkup labs
  stay context. The report does not say what to start or stop.
---

# 弹性蛋白片段

你交血清弹性蛋白片段浓度（pg/ml），以及可选的肽序列、其他基质碎片、现用药、体检、年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。浓度按正文的高组和正常组界值归类。透明质酸、纤连蛋白和胶原碎片没有界值列。年龄回归缺斜率和截距，不算。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`。弹性蛋白片段用 `弹性蛋白片段` 或 `ELN`，单位 pg/ml。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
