---
name: circadian-nad-meibomian-aging
description: >-
  Compares a NAD concentration in micromolar to the HSD3B1 and HSD3B2 Michaelis constants quoted by Sasaki et al. Use when the user mentions meibomian gland aging, HSD3B1, or this Nature Aging study. It does not score dry eye. Medicines and checkup labs do not edit the enzyme list.
---

# 睑板腺的局部甾体合成

用户交 NAD 浓度（微摩尔）、可选的 HSD3B1 或 Hsd3b6 测量、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。NAD 只和正文写出的两个米氏常数比较。不换成泪膜或腺体分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements measures.txt \
  --out out
```

引用 `out/report.md`，包括 `边界:` 那一行。

