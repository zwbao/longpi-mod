---
name: sirtuin2-opc-remyelination
description: >-
  Computes the nucleus-to-total SIRT2 ratio when both values are supplied, the
  localization readout in Ma et al., Nature Communications 2022. It does not
  turn the mouse β-NMN dose into a human dose. Use when the user mentions
  SIRT2 nuclear entry, oligodendrocyte progenitor cells, remyelination, or
  β-NMN in this paper. Medicines and checkup labs do not edit the method list.
  The report does not say what to start or stop.
---

# 少突胶质前体细胞里的核内去乙酰化酶

用户交 SIRT2 的核内量和总量、可选的年龄、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

两个数都有且总量不是零时，报告写出核内量除以总量。缺一列就写明缺哪一列。小鼠腹腔剂量不换成人用剂量。队列里老年相对青年的比例不拿来填你的空缺。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`measurements.csv` 用 `name,value`。列名是 `sirt2_nucleus` 和 `sirt2_total`。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
