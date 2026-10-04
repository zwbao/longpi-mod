---
name: human-ovarian-aging-foxp1
description: >-
  Places a supplied age in the young, middle, or older groups printed for this ovarian atlas, and lists cell types or FOXP1 when the user names them. Use when the user mentions human ovarian spatial transcriptomics, FOXP1, CDKN1A, or doi:10.1038/s43587-024-00607-1. Marker tables have log fold changes and no intercept, so no transcriptomic age is calculated. Labs do not add cell types.
---

# 人卵巢时空转录组

用户交年龄、点到的细胞或基因、现用药和体检。不要向用户要 GEO、STRING 或 PDF。报告开头是论文卡片。

年龄只对照正文的三个组。标志物表没有截距，所以不算个人转录组年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 22 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。细胞写 `颗粒细胞,named`。方法说明见 [references/claims.md](references/claims.md)。
