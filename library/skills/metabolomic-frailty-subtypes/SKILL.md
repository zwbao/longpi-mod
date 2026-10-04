---
name: metabolomic-frailty-subtypes
description: >-
  Assigns one person's eleven Nightingale NMR metabolites to the nearest
  frailty-subtype mean in Table 2 of Xiao et al., npj Digital Medicine 2025.
  Use when the user mentions metabolomic frailty subtypes, GlycA, LGVF, HALF,
  LALF, HGVF, or this 11-metabolite panel. Current medicines and checkup labs
  are context. The report does not say what to start or stop.
---

# 代谢衰弱亚型

用户交十一个核磁共振代谢物、现用药和体检。不要向用户要英国生物银行、GEO 或 PDF。未公布的聚类中心不要写成已经跑过。

报告只算到四个已发表亚型均值的距离。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --metabolites mets.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

`mets.csv` 用两列 `name,value`。可选 `--fi` 和 `--diet` 不改变亚型。方法说明见 [references/claims.md](references/claims.md)。
