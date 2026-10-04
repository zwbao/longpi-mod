---
name: one-year-mortality-aging-marker
description: >-
  States that one-year mortality is not scored from a supplied age and
  sex, because the baseline coefficients and the recurrent-network
  weights are not in the PDF. Use when the user mentions the Finnish
  one-year mortality model, FinRegistry, or this Nature Aging paper.
  Medicines and checkup labs do not create a risk.
---

# 一年死亡标记

用户交年龄、性别、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

年龄和性别只照录。基线模型的系数列和循环网络的权重都不在 PDF 里，不算一年死亡概率。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out
```

`--measurements` 用 `name,value`。性别的名字是 `sex`。`--age` 是实足年龄。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
