---
name: aged-skin-il36-osteoarthritis
description: >-
  Records IL-36Ra and the three IL-36 agonists, and notes spesolimab, from Chen et al. on aged skin and osteoarthritis. Use when the user mentions IL-36, aged epidermis, or this Nature Communications study. No joint score is invented. Medicines and checkup labs do not edit the name list.
---

# 老化皮肤与关节炎症

用户交 IL-36Ra、三种 IL-36 激动剂的测量、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。给了数值就照录。没有把浓度换成关节分数的系数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

