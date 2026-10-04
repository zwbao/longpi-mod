---
name: human-ovarian-aging-multiomics
description: >-
  Places a supplied age in the young or reproductively aged donor windows, and checks named cell types, pathways, and genes against the printed directions and Supplementary Table 6. Use when the user mentions ovarian single-nuclei multi-omics, CEBPD, mTOR, or doi:10.1038/s43587-024-00762-5. That gene column has no weight or intercept, so no ovarian age is calculated. Labs do not add genes.
---

# 人卵巢单核多组学

用户交年龄、点到的细胞、通路或基因、现用药和体检。不要向用户要 GEO、STRING 或 PDF。报告开头是论文卡片。

年龄只对照正文的两组。Supplementary Table 6 只有基因名，没有权重或截距，所以不算个人卵巢年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 53 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。基因写 `RICTOR,named`。方法说明见 [references/claims.md](references/claims.md)。
