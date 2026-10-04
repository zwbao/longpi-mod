---
name: iron-fibrosis-senescence
description: >-
  Matches supplied gene symbols to the published iron accumulation signature
  and maps an IFTA score onto the fibrosis group labels in the supplement.
  It does not score serum iron or MRI iron, because those tables have no
  cutoff column, and it does not invent gene weights. Use when the user
  mentions iron accumulation, senescence-associated fibrosis, or this
  iron-fibrosis paper. Medicines and checkup labs stay context. The report
  does not say what to start or stop.
---

# 铁与纤维化衰老

你交基因符号、IFTA 分数，以及可选的现用药、体检、年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。对上补充数据表里的铁堆积基因就写入名单，没有权重。IFTA 为 0 或 1、2 或 3 时，写入表里的分组词。血清铁和磁共振铁没有界值列，不算进名单。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`。基因名写在 name 列。IFTA 用 `IFTA` 和 0 到 3 的分数。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
