---
name: cardiac-ageing-matrix-mechanics
description: >-
  Places one supplied cardiac Young's modulus next to the published young and
  aged tissue means, and names a DECIPHER scaffold only when matrix age and
  soft or stiff are both stated. A gene is called differential only when its
  fold change and p value meet the published rule. It does not invent
  fibroblast weights. Use when the user mentions DECIPHER cardiac scaffolds,
  cardiac matrix stiffness, or this cardiac ageing extracellular-matrix paper.
  Medicines and checkup labs stay context. The report does not say what to
  start or stop.
---

# 心脏基质力学

你交杨氏模量、基质年龄、软或硬，以及可选的基因倍数和 p 值、现用药、体检、年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。杨氏模量只和正文图里的均值做差。基质年龄和软硬都有时，才写出 SoftY、StiffY、SoftA、StiffA。基因要同时有倍数和 p 值，才按扩展数据图里的规则判断。没有系数的步骤写明缺哪一列。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`。杨氏模量用 kPa。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
