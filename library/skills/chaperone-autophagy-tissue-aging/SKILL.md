---
name: chaperone-autophagy-tissue-aging
description: >-
  Computes the chaperone-mediated autophagy lysosome percentage as KDendra and LAMP1 double-positive puncta divided by LAMP1 puncta, the ratio in Khawaja et al., Nature Aging 2025. It does not compute the transcriptional CMA score, because cmascore_genes.xlsx has direction and weight but no per-gene mean or standard deviation. Use when the user mentions this sex-specific CMA atlas, LAMP2A, or KFERQ-Dendra. Checkup labs do not change the list.
---

# 组织里的伴侣介导自噬

两种点计数都有时，报告计算有能力溶酶体的百分比。基因表有方向和权重，没有均值和标准差，所以不算转录分数。小鼠里的组织方向写在名单旁边，不是你的分数。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删名单。

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

字段名 `kdendra_lamp1_puncta` 和 `lamp1_puncta`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
