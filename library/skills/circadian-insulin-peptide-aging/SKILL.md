---
name: circadian-insulin-peptide-aging
description: >-
  Places a fly age in days against the 3-day and 40-day comparisons, and lists LKRSDH, dilp2, dilp3, dilp5, and art4 from Lv et al. Use when the user mentions LKRSDH, insulin-like peptides, and circadian aging in Drosophila or this Nature Communications study. Fold changes are not invented. Medicines and checkup labs do not edit the gene list.
---

# 果蝇胰岛素样肽与节律

用户交果蝇日龄和 LKRSDH、dilp2、dilp3、dilp5、art4 的测量，以及现用药和体检。人的岁数不换算成日龄。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。日龄只对照 3 日和 40 日。基因表达照录，不判上调。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

