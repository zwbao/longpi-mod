---
name: centenarian-longevity-genes
description: >-
  Matches gene names the user supplies to centenarian loss-of-function genes
  named by Ying et al., Nature Communications 2024
  (doi:10.1038/s41467-024-52967-2), including Supplementary Data 1 rows that
  pass the paper's false-discovery threshold in centenarians and genes named
  in the text such as RGP1, PCNX2, and ANO9. Use when the user mentions this
  centenarian burden study or those genes. Does not score a mutation burden
  or assign UK Biobank validation. Labs do not add genes.
---

# 百岁人群里点名的长寿基因

用户交基因名、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。报告开头是论文卡片。补充表里的效应估计不乘成个人负担。

对上的基因写入方法名单。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。基因名用正文或补充表里的符号。方法说明见 [references/claims.md](references/claims.md)。
