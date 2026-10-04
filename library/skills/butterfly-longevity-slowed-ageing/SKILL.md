---
name: butterfly-longevity-slowed-ageing
description: >-
  Looks up one named Heliconiini species in the maximum-lifespan table of
  the tropical butterfly paper. Use when the user gives a species, adult
  age, medicines, or checkup labs and asks about slowed ageing in
  Heliconius. Fitted Gompertz alpha and beta are not in the opened
  supplement, so no survival probability is scored. Medicines and labs
  do not edit the lookup.
---

# 蝶类寿命记录

用户交种名、成虫日龄、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

种名对上正文表一时，报告写下那一条最长寿命记录，并照录成虫日龄。这不是死亡概率。表二到表四的尺度参数和速率参数不在已打开的补充表列里。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`。种名的名字是 `species`。`--age` 是成虫日龄，从羽化算起。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
