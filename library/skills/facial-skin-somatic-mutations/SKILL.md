---
name: facial-skin-somatic-mutations
description: >-
  Checks whether NOTCH1, NOTCH2, NOTCH3, TP53, and FAT1 are marked in a call list from King et al. on aging facial skin. Use when the user mentions somatic mutations in eyelid or facial epidermis, or this Nature Genetics study. Country means are not written as a personal risk. Medicines and checkup labs do not edit the gene list.
---

# 面部皮肤的体细胞突变

用户交突变基因是否有记录、可选的国家、现用药和体检。不要向用户要 EGA、STRING 或 PDF。

报告开头是论文卡片。五个基因只核对有没有记录。两国的突变负荷均值不写成这个人的分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

