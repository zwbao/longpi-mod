---
name: hgps-skin-base-editor
description: >-
  Checks whether an LMNA allele matches the c.1824 C to T progeria mutation corrected in mouse skin by Whisenant et al. Use when the user mentions Hutchinson-Gilford progeria, progerin, or this Nature Communications skin study. Editing percentages are not a personal skin score. Medicines and checkup labs do not edit the allele call.
---

# 早衰皮肤的碱基编辑

用户交 LMNA 第 1824 位的等位记录、现用药和体检。不要向用户要 SRA、STRING 或 PDF。

报告开头是论文卡片。只核对是否对上正文要校正的那个突变。不把小鼠皮肤里的校正比例写成这个人的分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

