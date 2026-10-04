---
name: foxo-oser1-oxidative-lifespan
description: >-
  Matches OSER1 and rsIDs the user supplies to Supplementary Tables 5 and 6
  of Song et al., Nature Communications 2024
  (doi:10.1038/s41467-024-51542-z). Use when the user mentions OSER1,
  FOXO-regulated oxidative-stress lifespan, or those human longevity SNPs.
  Does not multiply odds ratios. Labs do not add variants.
---

# 氧化应激响应蛋白的长寿变异

用户交基因名或 rs 编号、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。报告开头是论文卡片。补充表里的比值比不算个人分数。

对上的名字写入方法名单。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`measurements.csv` 用两列 `name,value`。可以写 OSER1 或 rs 编号。方法说明见 [references/claims.md](references/claims.md)。
