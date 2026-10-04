---
name: cerebrospinal-fluid-molecular-subtypes
description: >-
  Writes a personal readout of the five cerebrospinal-fluid proteomic Alzheimer subtypes from Tijms et al., Nature Aging 2024. It keeps the published subtype counts and does not assign a subtype without the factorization loadings. Use when the user mentions these CSF subtypes, TREM2 R47H enrichment in subtype 1, or this paper. Medicines and checkup labs stay context.
---

# 脑脊液里的阿尔茨海默病亚型

这次不会把你分进亚型，因为分型用的载荷不在已读材料里。你交了蛋白数值也只被点数，不改变五个亚型的名字。报告不写各组人数和年龄。

不要向用户要蛋白质组矩阵或 PDF。不要另造载荷。现用药对不上时写「不能据此停」。体检不增删名单。

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

`--measurements` 用两列 `item,value`，蛋白用基因符号。`--labs` 原样写入报告。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
